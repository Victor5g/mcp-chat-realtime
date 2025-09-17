'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { OutgoingEvent, StatusUpdatePayload, ToolRequestPayload, WsEvent } from './ws_events'

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type ChatClientState = {
  sessionId?: string
  connection: ConnectionState
  aiTyping: boolean
  busy: boolean
  toolRunning: boolean
  filePath?: string
  messages: ChatMessage[]
  pendingTool?: ToolRequestPayload
  toolChunks: string[]
  errorMessage?: string
  errorDetail?: string
  assistantError?: string
  awaitingAssistant: boolean
}

const initialState: ChatClientState = {
  connection: 'connecting',
  aiTyping: false,
  busy: false,
  toolRunning: false,
  messages: [],
  toolChunks: [],
  awaitingAssistant: false
}

type Action =
  | { type: 'connection'; status: ConnectionState }
  | { type: 'session'; sessionId: string }
  | { type: 'status_update'; data: StatusUpdatePayload }
  | { type: 'ai_chunk'; text: string }
  | { type: 'assistant_complete'; reason?: 'ok' | 'error' }
  | { type: 'tool_request'; payload: ToolRequestPayload }
  | { type: 'tool_chunk'; chunk: string }
  | { type: 'error'; message: string; detail?: string }
  | { type: 'user_message'; text: string }
  | { type: 'clear_error' }
  | { type: 'reset_tool' }

const reducer = (state: ChatClientState, action: Action): ChatClientState => {
  switch (action.type) {
    case 'connection':
      return { ...state, connection: action.status }
    case 'session':
      return { ...state, sessionId: action.sessionId }
    case 'status_update': {
      const update: Partial<ChatClientState> = {}
      if (typeof action.data.ai_typing === 'boolean') update.aiTyping = action.data.ai_typing
      if (typeof action.data.tool_running === 'boolean') update.toolRunning = action.data.tool_running
      if (typeof action.data.busy === 'boolean') update.busy = action.data.busy
      if (typeof action.data.file_path === 'string') update.filePath = action.data.file_path
      if (typeof action.data.error === 'string') update.errorMessage = action.data.error
      return { ...state, ...update }
    }
    case 'ai_chunk': {
      const last = state.messages[state.messages.length - 1]
      if (!last || last.role !== 'assistant') {
        return {
          ...state,
          messages: [...state.messages, { id: crypto.randomUUID(), role: 'assistant', text: action.text }]
        }
      }
      const nextMessages = [...state.messages]
      nextMessages[nextMessages.length - 1] = { ...last, text: last.text + action.text }
      return { ...state, messages: nextMessages }
    }
    case 'assistant_complete':
      return {
        ...state,
        aiTyping: false,
        awaitingAssistant: false,
        assistantError: action.reason === 'error' ? 'A resposta da IA não foi concluída.' : undefined
      }
    case 'tool_request':
      return {
        ...state,
        pendingTool: action.payload,
        toolChunks: [],
        assistantError: undefined
      }
    case 'tool_chunk':
      return { ...state, toolChunks: [...state.toolChunks, action.chunk] }
    case 'error':
      return { ...state, errorMessage: action.message, errorDetail: action.detail }
    case 'user_message':
      return {
        ...state,
        messages: [...state.messages, { id: crypto.randomUUID(), role: 'user', text: action.text }],
        awaitingAssistant: true,
        assistantError: undefined,
        errorMessage: undefined,
        errorDetail: undefined,
        toolChunks: [],
        pendingTool: undefined
      }
    case 'clear_error':
      return { ...state, errorMessage: undefined, errorDetail: undefined }
    case 'reset_tool':
      return { ...state, pendingTool: undefined, toolChunks: [] }
    default:
      return state
  }
}

export type ChatClientActions = {
  sendMessage: (text: string) => void
  approveTool: () => void
  denyTool: () => void
  reconnect: () => void
  clearError: () => void
}

export const useChatClient = (wsUrl: string) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }

  const cleanupSocket = () => {
    if (socketRef.current) {
      socketRef.current.onclose = null
      socketRef.current.onmessage = null
      socketRef.current.onerror = null
      socketRef.current.onopen = null
      socketRef.current.close()
      socketRef.current = null
    }
  }

  const handleServerEvent = useCallback((evt: WsEvent) => {
    switch (evt.type) {
      case 'session_created':
        dispatch({ type: 'session', sessionId: evt.data.session_id })
        break
      case 'status_update':
        dispatch({ type: 'status_update', data: evt.data })
        break
      case 'ai_chunk':
        dispatch({ type: 'ai_chunk', text: evt.data.text })
        break
      case 'assistant_message_completed':
        dispatch({ type: 'assistant_complete', reason: evt.data?.reason })
        dispatch({ type: 'reset_tool' })
        break
      case 'tool_request':
        dispatch({ type: 'tool_request', payload: evt.data })
        break
      case 'tool_chunk':
        dispatch({ type: 'tool_chunk', chunk: evt.data.chunk })
        break
      case 'error':
        dispatch({ type: 'error', message: evt.data.message, detail: evt.data.detail })
        break
      default:
        break
    }
  }, [])

  const connect = useCallback(() => {
    clearReconnectTimer()
    cleanupSocket()
    dispatch({ type: 'connection', status: reconnectAttempts.current > 0 ? 'reconnecting' : 'connecting' })
    try {
      const ws = new WebSocket(wsUrl)
      socketRef.current = ws
      ws.onopen = () => {
        reconnectAttempts.current = 0
        dispatch({ type: 'connection', status: 'open' })
      }
      ws.onmessage = event => {
        try {
          const parsed = JSON.parse(event.data as string) as WsEvent
          handleServerEvent(parsed)
        } catch (error) {
          dispatch({ type: 'error', message: 'invalid_server_payload', detail: error instanceof Error ? error.message : String(error) })
        }
      }
      ws.onclose = () => {
        dispatch({ type: 'connection', status: 'reconnecting' })
        reconnectAttempts.current += 1
        const delay = Math.min(8000, 1000 * reconnectAttempts.current)
        reconnectTimerRef.current = window.setTimeout(() => connect(), delay)
      }
      ws.onerror = () => {
        dispatch({ type: 'error', message: 'socket_error' })
        ws.close()
      }
    } catch (error) {
      dispatch({ type: 'error', message: 'socket_init_failed', detail: error instanceof Error ? error.message : String(error) })
    }
  }, [handleServerEvent, wsUrl])

  useEffect(() => {
    connect()
    return () => {
      clearReconnectTimer()
      cleanupSocket()
    }
  }, [connect])

  const sendEvent = useCallback((event: OutgoingEvent) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      dispatch({ type: 'error', message: 'socket_not_ready' })
      return
    }
    socket.send(JSON.stringify(event))
  }, [])

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    dispatch({ type: 'user_message', text: trimmed })
    sendEvent({ type: 'user_message', data: { text: trimmed } })
  }, [sendEvent])

  const approveTool = useCallback(() => {
    if (!state.pendingTool) return
    dispatch({ type: 'reset_tool' })
    sendEvent({ type: 'tool_approval', data: { tool_use_id: state.pendingTool.id, approved: true } })
  }, [sendEvent, state.pendingTool])

  const denyTool = useCallback(() => {
    if (!state.pendingTool) return
    dispatch({ type: 'reset_tool' })
    sendEvent({ type: 'tool_approval', data: { tool_use_id: state.pendingTool.id, approved: false } })
  }, [sendEvent, state.pendingTool])

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  const clearError = useCallback(() => dispatch({ type: 'clear_error' }), [])

  const canSend = state.connection === 'open' && !state.busy && !state.awaitingAssistant

  return {
    state: { ...state, canSend },
    actions: { sendMessage, approveTool, denyTool, reconnect, clearError }
  }
}

export type ChatClientHook = ReturnType<typeof useChatClient>
