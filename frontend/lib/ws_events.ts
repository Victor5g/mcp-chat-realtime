export type ToolRequestPayload = {
  id: string
  name: 'create_file'
  input: {
    path: string
    content: string
  }
}

export type StatusUpdatePayload = {
  ai_typing?: boolean
  tool_running?: boolean
  file_path?: string
  busy?: boolean
  reconnecting?: boolean
  error?: string
}

export type WsEvent =
  | { type: 'session_created'; data: { session_id: string } }
  | { type: 'status_update'; data: StatusUpdatePayload }
  | { type: 'ai_chunk'; data: { text: string } }
  | { type: 'assistant_message_completed'; data?: { reason: 'ok' | 'error' } }
  | { type: 'tool_request'; data: ToolRequestPayload }
  | { type: 'tool_chunk'; data: { chunk: string } }
  | { type: 'error'; data: { message: string; detail?: string } }

export type OutgoingEvent =
  | { type: 'user_message'; data: { text: string } }
  | { type: 'tool_approval'; data: { tool_use_id: string; approved: boolean } }
