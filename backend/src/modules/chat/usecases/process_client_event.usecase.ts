import { ChatSession } from '../domain/chat_session.js'
import { logger } from '../../../logger.js'
import { observe_duration, increment_counter, start_timer } from '../../../metrics.js'
import { tool_input_schema } from '../domain/schemas.js'
import type {
  AssistantContentBlock,
  ClientEvent,
  Message,
  PendingToolCall,
  ServerEvent,
  ToolResultPayload
} from '../domain/types.js'

type AnthropicStreamFn = ({
  messages,
  on_text,
  on_tool,
  on_status,
  on_end,
  on_error
}: {
  messages: Message[]
  on_text?: (text: string) => void
  on_tool?: (tool: PendingToolCall) => void
  on_status?: (status: Record<string, unknown>) => void
  on_end?: (payload: { content: AssistantContentBlock[] }) => void
  on_error?: (error: unknown) => void
}) => Promise<void>

export type Process_client_event_deps = {
  anthropic_stream: AnthropicStreamFn
  anthropic_resume: AnthropicStreamFn
  stream_create_file: typeof import('../services/mcp_tool_service.js').stream_create_file
}

export class Process_client_event_usecase {
  private deferred_tool_result: { tool_use_id: string; result: ToolResultPayload } | null = null

  constructor(
    private readonly session: ChatSession,
    private readonly send_event: (event: ServerEvent) => void,
    private readonly deps: Process_client_event_deps
  ) {}

  private map_ai_error(error: unknown): { message: string; detail?: string } {
    const toStringDetail = (d: unknown): string | undefined => {
      if (!d) return undefined
      if (typeof d === 'string') return d
      try {
        return JSON.stringify(d)
      } catch {
        try {
          return String(d)
        } catch {
          return undefined
        }
      }
    }
    let status: number | undefined
    let detail: unknown
    let errorMessage: string | undefined
    if (error && typeof error === 'object') {
      const anyErr = error as Record<string, unknown>
      if (typeof anyErr.status === 'number') status = anyErr.status
      if ('detail' in anyErr) detail = (anyErr as { detail?: unknown }).detail
      if (typeof anyErr['message'] === 'string') errorMessage = anyErr['message'] as string
    }
    // Tenta extrair mensagem da estrutura { error: { message } }
    try {
      const raw = typeof detail === 'string' ? JSON.parse(detail) : detail
      if (raw && typeof raw === 'object' && 'error' in raw) {
        const inner = (raw as any).error
        if (inner && typeof inner.message === 'string') errorMessage = inner.message
      }
    } catch {
      // ignore
    }
    const detailStr = toStringDetail(detail)
    const haystack = `${errorMessage ?? ''} ${detailStr ?? ''}`.toLowerCase()
    if (haystack.includes('credit balance is too low')) {
      return { message: 'ai_saldo_insuficiente', detail: errorMessage || detailStr }
    }
    if (status === 401 || status === 403) {
      return { message: 'ai_nao_autorizado', detail: errorMessage || detailStr }
    }
    if (status === 429) {
      return { message: 'ai_limite_excedido', detail: errorMessage || detailStr }
    }
    if (typeof status === 'number' && status >= 500) {
      return { message: 'ai_indisponivel', detail: errorMessage || detailStr }
    }
    return { message: 'ai_error', detail: errorMessage || detailStr }
  }

  async handle_event(event: ClientEvent) {
    if (event.type === 'user_message') {
      await this.handle_user_message(event.data.text)
    } else if (event.type === 'tool_approval') {
      await this.handle_tool_approval(event.data.tool_use_id, event.data.approved)
    }
  }

  private async handle_user_message(text: string) {
    if (this.session.active) {
      this.send_event({ type: 'status_update', data: { busy: true } })
      increment_counter('ws_busy_rejections_total')
      return
    }
    this.session.add_user_message(text)
    this.session.active = true
    increment_counter('ws_user_messages_total')
    increment_counter('anthropic_requests_total')
    const stop_timer = start_timer()
    try {
      await this.deps.anthropic_stream({
        messages: this.session.history,
        on_text: text_chunk => this.send_event({ type: 'ai_chunk', data: { text: text_chunk } }),
        on_tool: tool => this.handle_tool_use(tool),
        on_status: status => this.forward_status(status),
        on_end: payload => {
          this.session.add_assistant_blocks(payload.content)
          this.session.active = false
          this.send_event({ type: 'assistant_message_completed', data: { reason: 'ok' } })
          void this.process_deferred_tool_result()
        },
        on_error: error => {
          logger.error('anthropic_stream_failed', { error, session_id: this.session.session_id })
          increment_counter('anthropic_errors_total')
          this.session.active = false
          this.session.clear_pending_tool()
          this.send_event({ type: 'status_update', data: { ai_typing: false } })
          const mapped = this.map_ai_error(error)
          this.send_event({ type: 'error', data: mapped })
          this.send_event({ type: 'assistant_message_completed', data: { reason: 'error' } })
        }
      })
    } catch (error) {
      logger.error('anthropic_stream_exception', { error, session_id: this.session.session_id })
      increment_counter('anthropic_errors_total')
      this.session.active = false
      this.session.clear_pending_tool()
      this.send_event({ type: 'status_update', data: { ai_typing: false } })
      const mapped = this.map_ai_error(error)
      this.send_event({ type: 'error', data: mapped })
      this.send_event({ type: 'assistant_message_completed', data: { reason: 'error' } })
    } finally {
      const duration = stop_timer()
      observe_duration('anthropic_stream_duration_ms', duration)
    }
  }

  private async handle_tool_approval(tool_use_id: string, approved: boolean) {
    const pending_tool = this.session.pending_tool
    if (!pending_tool || pending_tool.id !== tool_use_id) {
      this.send_event({ type: 'error', data: { message: 'no_pending_tool' } })
      return
    }
    if (!approved) {
      this.session.record_tool_result(tool_use_id, { status: 'denied' })
      this.session.clear_pending_tool()
      await this.resume_after_tool()
      return
    }
    increment_counter('tool_approvals_total')
    const pending_input = tool_input_schema.safeParse(pending_tool.input)
    if (!pending_input.success) {
      this.send_event({ type: 'error', data: { message: 'tool_input_invalid' } })
      this.session.clear_pending_tool()
      return
    }
    let tool_result: ToolResultPayload
    this.send_event({ type: 'status_update', data: { tool_running: true, file_path: pending_input.data.path } })
    try {
      let final_stats: { file_path?: string; size?: number } = {}
      for await (const event of this.deps.stream_create_file({ rel_path: pending_input.data.path, content: pending_input.data.content })) {
        if (event.chunk) this.send_event({ type: 'tool_chunk', data: { chunk: event.chunk } })
        if (event.done) final_stats = { file_path: event.file_path, size: event.size }
      }
      tool_result = {
        status: 'ok',
        file_path: final_stats.file_path ?? pending_input.data.path,
        size: final_stats.size ?? pending_input.data.content.length
      }
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error)
      logger.error('tool_execution_failed', { error: error_message, session_id: this.session.session_id, tool_use_id })
      increment_counter('tool_errors_total')
      const error_code = error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : 'tool_execution_failed'
      this.send_event({ type: 'error', data: { message: 'tool_error', detail: error_message } })
      tool_result = {
        status: 'error',
        error_code,
        message: error_message
      }
    } finally {
      this.send_event({ type: 'status_update', data: { tool_running: false } })
    }
    this.session.record_tool_result(tool_use_id, tool_result)
    this.session.clear_pending_tool()
    await this.resume_after_tool()
  }

  private async resume_after_tool() {
    this.session.active = true
    increment_counter('anthropic_requests_total')
    const stop_timer = start_timer()
    try {
      await this.deps.anthropic_resume({
        messages: this.session.history,
        on_text: text_chunk => this.send_event({ type: 'ai_chunk', data: { text: text_chunk } }),
        on_tool: tool => this.handle_tool_use(tool),
        on_status: status => this.forward_status(status),
        on_end: payload => {
          this.session.add_assistant_blocks(payload.content)
          this.session.active = false
          this.send_event({ type: 'assistant_message_completed', data: { reason: 'ok' } })
        },
        on_error: error => {
          logger.error('anthropic_resume_failed', { error, session_id: this.session.session_id })
          increment_counter('anthropic_errors_total')
          this.session.active = false
          this.session.clear_pending_tool()
          this.send_event({ type: 'status_update', data: { ai_typing: false } })
          const mapped = this.map_ai_error(error)
          this.send_event({ type: 'error', data: mapped })
          this.send_event({ type: 'assistant_message_completed', data: { reason: 'error' } })
        }
      })
    } catch (error) {
      logger.error('anthropic_resume_exception', { error, session_id: this.session.session_id })
      increment_counter('anthropic_errors_total')
      this.session.active = false
      this.session.clear_pending_tool()
      this.send_event({ type: 'status_update', data: { ai_typing: false } })
      const mapped = this.map_ai_error(error)
      this.send_event({ type: 'error', data: mapped })
      this.send_event({ type: 'assistant_message_completed', data: { reason: 'error' } })
    } finally {
      const duration = stop_timer()
      observe_duration('anthropic_resume_duration_ms', duration)
    }
  }

  private handle_tool_use(tool: PendingToolCall) {
    const parsed_input = tool_input_schema.safeParse(tool.input)
    if (!parsed_input.success) {
      logger.warn('tool_request_invalid_input', { issues: parsed_input.error.issues, session_id: this.session.session_id })
      this.send_event({ type: 'error', data: { message: 'tool_input_invalid' } })
      const tool_result: ToolResultPayload = {
        status: 'error',
        error_code: 'invalid_tool_input',
        message: 'Payload inválido recebido para a ferramenta'
      }
      this.deferred_tool_result = { tool_use_id: tool.id, result: tool_result }
      return
    }
    const normalized_tool: PendingToolCall = {
      ...tool,
      input: parsed_input.data
    }
    this.session.set_pending_tool(normalized_tool)
    increment_counter('tool_requests_total')
    this.send_event({ type: 'tool_request', data: normalized_tool })
  }

  private forward_status(status: Record<string, unknown>) {
    const payload: Record<string, unknown> = {}
    if (typeof status.ai_typing === 'boolean') payload.ai_typing = status.ai_typing
    if (typeof status.tool_running === 'boolean') payload.tool_running = status.tool_running
    if (typeof status.file_path === 'string') payload.file_path = status.file_path
    if (typeof status.busy === 'boolean') payload.busy = status.busy
    if (Object.keys(payload).length > 0) this.send_event({ type: 'status_update', data: payload })
  }

  private async process_deferred_tool_result() {
    if (!this.deferred_tool_result) return
    const deferred = this.deferred_tool_result
    this.deferred_tool_result = null
    this.session.record_tool_result(deferred.tool_use_id, deferred.result)
    this.session.clear_pending_tool()
    await this.resume_after_tool()
  }
}
