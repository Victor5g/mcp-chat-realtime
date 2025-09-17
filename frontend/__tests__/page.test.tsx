import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from '../app/page'
import { useChatClient } from '@/lib/use_chat_client'
import type { ChatClientHook } from '@/lib/use_chat_client'
import type { ToolRequestPayload } from '@/lib/ws_events'

vi.mock('@/lib/use_chat_client', () => ({
  useChatClient: vi.fn()
}))

const useChatClientMock = vi.mocked(useChatClient)

const makeState = (overrides: Partial<ChatClientHook['state']> = {}): ChatClientHook['state'] => ({
  connection: 'open',
  aiTyping: false,
  busy: false,
  toolRunning: false,
  messages: [],
  toolChunks: [],
  awaitingAssistant: false,
  canSend: true,
  ...overrides
})

const mockHook = (state: ChatClientHook['state'], actions: Partial<ChatClientHook['actions']> = {}) => {
  const defaults: ChatClientHook['actions'] = {
    approveTool: vi.fn(),
    denyTool: vi.fn(),
    reconnect: vi.fn(),
    sendMessage: vi.fn(),
    clearError: vi.fn()
  }
  useChatClientMock.mockReturnValue({ state, actions: { ...defaults, ...actions } })
}

describe('Page component', () => {
  beforeEach(() => {
    useChatClientMock.mockReset()
  })

  it('handles tool approval actions', async () => {
    const pendingTool: ToolRequestPayload = { id: 'tool-1', name: 'create_file', input: { path: 'file.txt', content: 'hello' } }
    const approve = vi.fn()
    const deny = vi.fn()
    mockHook(makeState({ pendingTool }), { approveTool: approve, denyTool: deny })

    render(<Page />)

    await userEvent.click(screen.getByRole('button', { name: /aprovar/i }))
    expect(approve).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /negar/i }))
    expect(deny).toHaveBeenCalledTimes(1)
  })

  it('displays formatted error messages and clears them', async () => {
    const clearError = vi.fn()
    mockHook(makeState({ errorMessage: 'tool_error', errorDetail: 'disk full' }), { clearError })

    render(<Page />)

    expect(screen.getByText(/tool falhou: disk full/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /dispensar/i }))
    expect(clearError).toHaveBeenCalled()
  })
})
