import { describe, expect, it, vi } from 'vitest'
import { ChatSession } from '../modules/chat/domain/chat_session.js'
import { Process_client_event_usecase } from '../modules/chat/usecases/process_client_event.usecase.js'
import { ToolExecutionError } from '../modules/chat/services/mcp_tool_service.js'
import type { ServerEvent, PendingToolCall } from '../modules/chat/domain/types.js'

describe('Process_client_event_usecase', () => {
  const make_pending_tool = (): PendingToolCall => ({
    type: 'tool_use',
    id: 'tool-1',
    name: 'create_file',
    input: { path: 'out.txt', content: 'data' }
  })

  const noop_anthropic = async () => {}

  const noop_stream = async function* () {
    // no-op generator
  }

  const completed_anthropic = async ({ on_end }: any) => {
    on_end?.({ content: [{ type: 'text', text: 'done' }] })
  }

  it('records denied tool approvals and resumes conversation', async () => {
    const session = new ChatSession()
    const sent: ServerEvent[] = []
    session.set_pending_tool(make_pending_tool())
    const resume_spy = vi.fn(completed_anthropic)
    const usecase = new Process_client_event_usecase(session, event => sent.push(event), {
      anthropic_stream: noop_anthropic as any,
      anthropic_resume: resume_spy as any,
      stream_create_file: noop_stream as any
    })

    await usecase.handle_event({ type: 'tool_approval', data: { tool_use_id: 'tool-1', approved: false } })

    expect(session.pending_tool).toBeNull()
    expect(session.active).toBe(false)
    expect(resume_spy).toHaveBeenCalled()
    const tool_message = session.history.find(msg => msg.role === 'user' && msg.content[0]?.type === 'tool_result')
    expect(tool_message).toBeDefined()
    if (!tool_message) throw new Error('tool result ausente')
    const block = tool_message.content[0]
    if (!block || block.type !== 'tool_result') throw new Error('bloco inválido')
    const payload = JSON.parse(block.content)
    expect(payload).not.toBeNull()
    expect(payload).toMatchObject({ status: 'denied' })
    const completion = sent.find(event => event.type === 'assistant_message_completed')
    expect(completion).toBeDefined()
  })

  it('auto-resumes when tool input is invalid', async () => {
    const session = new ChatSession()
    const sent: ServerEvent[] = []
    const anthropic_stream = async ({ on_tool, on_end }: any) => {
      on_tool?.({ type: 'tool_use', id: 'tool-auto', name: 'create_file', input: { path: '', content: '' } })
      on_end?.({ content: [{ type: 'tool_use', id: 'tool-auto', name: 'create_file', input: { path: '', content: '' } }] })
    }
    const resume_spy = vi.fn(completed_anthropic)
    const usecase = new Process_client_event_usecase(session, event => sent.push(event), {
      anthropic_stream: anthropic_stream as any,
      anthropic_resume: resume_spy as any,
      stream_create_file: noop_stream as any
    })

    await usecase.handle_event({ type: 'user_message', data: { text: 'hello' } })

    expect(resume_spy).toHaveBeenCalled()
    const block = session.history.find(msg => msg.role === 'user' && msg.content[0]?.type === 'tool_result')?.content[0]
    expect(block?.type).toBe('tool_result')
    if (block?.type === 'tool_result') {
      const payload = JSON.parse(block.content)
      expect(payload).toMatchObject({ status: 'error', error_code: 'invalid_tool_input' })
    }
    const error_event = sent.find(event => event.type === 'error' && event.data.message === 'tool_input_invalid')
    expect(error_event).toBeDefined()
  })

  it('streams tool chunks on approval success', async () => {
    const session = new ChatSession()
    session.set_pending_tool(make_pending_tool())
    const sent: ServerEvent[] = []
    const stream_stub = async function* () {
      yield { chunk: 'part1', written: 5 }
      yield { done: true, file_path: 'workspace/out.txt', size: 5 }
    }
    const resume_spy = vi.fn(completed_anthropic)
    const usecase = new Process_client_event_usecase(session, event => sent.push(event), {
      anthropic_stream: noop_anthropic as any,
      anthropic_resume: resume_spy as any,
      stream_create_file: stream_stub as any
    })

    await usecase.handle_event({ type: 'tool_approval', data: { tool_use_id: 'tool-1', approved: true } })

    const chunk_event = sent.find(event => event.type === 'tool_chunk')
    expect(chunk_event).toBeDefined()
    const status_events = sent.filter(event => event.type === 'status_update')
    expect(status_events.some(event => event.data.tool_running === true)).toBe(true)
    expect(status_events.some(event => event.data.tool_running === false)).toBe(true)
    const tool_message = session.history.find(msg => msg.role === 'user' && msg.content[0]?.type === 'tool_result')
    expect(tool_message).toBeDefined()
    if (!tool_message) throw new Error('tool result ausente')
    const block = tool_message.content[0]
    if (!block || block.type !== 'tool_result') throw new Error('bloco inválido')
    const payload = JSON.parse(block.content)
    expect(payload).not.toBeNull()
    expect(payload).toMatchObject({ status: 'ok' })
    expect(resume_spy).toHaveBeenCalled()
  })

  it('handles tool execution errors and returns error payload', async () => {
    const session = new ChatSession()
    session.set_pending_tool(make_pending_tool())
    const sent: ServerEvent[] = []
    const stream_stub = async function* () {
      throw new ToolExecutionError('write_failed', 'disk full')
    }
    const resume_spy = vi.fn(completed_anthropic)
    const usecase = new Process_client_event_usecase(session, event => sent.push(event), {
      anthropic_stream: noop_anthropic as any,
      anthropic_resume: resume_spy as any,
      stream_create_file: stream_stub as any
    })

    await usecase.handle_event({ type: 'tool_approval', data: { tool_use_id: 'tool-1', approved: true } })

    const error_event = sent.find(event => event.type === 'error' && event.data.message === 'tool_error')
    expect(error_event).toBeDefined()
    const tool_message = session.history.find(msg => msg.role === 'user' && msg.content[0]?.type === 'tool_result')
    expect(tool_message).toBeDefined()
    if (!tool_message) throw new Error('tool result ausente')
    const block = tool_message.content[0]
    if (!block || block.type !== 'tool_result') throw new Error('bloco inválido')
    const payload = JSON.parse(block.content)
    expect(payload).not.toBeNull()
    expect(payload).toMatchObject({ status: 'error', error_code: 'write_failed' })
    expect(resume_spy).toHaveBeenCalled()
  })
})
