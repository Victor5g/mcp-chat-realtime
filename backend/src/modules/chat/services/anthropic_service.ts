import { env } from '../../../env.js'
import { logger } from '../../../logger.js'
import { tool_input_schema, anthropic_event_schema } from '../domain/schemas.js'
import type {
  AssistantContentBlock,
  Message,
  PendingToolCall,
  ToolName
} from '../domain/types.js'
import { sse_iter } from '../../../utils.js'

const api_url = 'https://api.anthropic.com/v1/messages'

export const tool_schema = [
  {
    name: 'create_file' satisfies ToolName,
    description: 'Cria um arquivo e popula em chunks',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    }
  }
]

export const system_prompt = `Você é um assistente que ajuda o usuário a criar e inspecionar arquivos.
Quando for apropriado criar um arquivo, chame a tool create_file com os campos path e content.
Aguarde o retorno do tool_result para continuar a resposta.
Se a criação for negada, responda sem usar a ferramenta.`

type AnthropicCallbacks = {
  on_text?: (text: string) => void
  on_tool?: (tool: PendingToolCall) => void
  on_status?: (s: Record<string, unknown>) => void
  on_end?: (m: { content: AssistantContentBlock[] }) => void
  on_error?: (e: unknown) => void
}

const parse_tool_input = (raw: string): PendingToolCall['input'] | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const result = tool_input_schema.safeParse(parsed)
    if (result.success) return result.data
    logger.warn('anthropic_tool_input_invalid', { issues: result.error.issues })
    return null
  } catch (error) {
    logger.warn('anthropic_tool_input_parse_failed', { error })
    return null
  }
}

export const anthropic_stream = async ({ messages, on_text, on_tool, on_status, on_end, on_error }: { messages: Message[] } & AnthropicCallbacks) => {
  const timer = process.hrtime.bigint()
  try {
    on_status?.({ ai_typing: true })
    const res = await fetch(api_url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.anthropic_api_key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: env.anthropic_model,
        max_tokens: 4096,
        system: system_prompt,
        messages,
        tools: tool_schema,
        stream: true
      })
    })
    if (!res.ok || !res.body) {
      let detail: unknown = undefined
      try {
        const text = await res.text()
        try {
          detail = JSON.parse(text)
        } catch {
          detail = text
        }
      } catch {
        // ignore
      }
      const err: any = new Error(`anthropic_http_${res.status}`)
      err.status = res.status
      err.detail = detail
      throw err
    }
    const assistant_blocks: AssistantContentBlock[] = []
    const current: { tool_block: PendingToolCall | null; input_json_str: string } = {
      tool_block: null,
      input_json_str: ''
    }
    for await (const raw_event of sse_iter(res)) {
      const event_result = anthropic_event_schema.safeParse(raw_event)
      if (!event_result.success) {
        logger.warn('anthropic_event_invalid', { raw: raw_event })
        continue
      }
      const evt = event_result.data
      if (evt.type === 'content_block_start' && 'content_block' in evt && evt.content_block.type === 'text') {
        if (!assistant_blocks.length || assistant_blocks.at(-1)?.type !== 'text') {
          assistant_blocks.push({ type: 'text', text: '' })
        }
      }
      if (evt.type === 'content_block_delta' && 'delta' in evt && evt.delta?.type === 'text_delta') {
        const text = evt.delta.text ?? ''
        on_text?.(text)
        if (!assistant_blocks.length || assistant_blocks.at(-1)?.type !== 'text') {
          assistant_blocks.push({ type: 'text', text: '' })
        }
        const last = assistant_blocks.at(-1)
        if (last?.type === 'text') {
          last.text += text
        }
      }
      if (evt.type === 'content_block_start' && 'content_block' in evt && evt.content_block.type === 'tool_use') {
        const id = evt.content_block.id ?? ''
        const name = (evt.content_block.name ?? 'create_file') as PendingToolCall['name']
        current.tool_block = { type: 'tool_use', id, name, input: { path: '', content: '' } }
        current.input_json_str = ''
        assistant_blocks.push(current.tool_block)
      }
      if (evt.type === 'content_block_delta' && 'delta' in evt && evt.delta?.type === 'input_json_delta') {
        current.input_json_str += evt.delta.partial_json ?? ''
      }
      if (evt.type === 'content_block_stop' && current.tool_block) {
        const parsed = parse_tool_input(current.input_json_str)
        if (parsed) {
          current.tool_block.input = parsed
          on_tool?.(current.tool_block)
        } else {
          on_tool?.({ ...current.tool_block, input: { path: '', content: '' } })
        }
        current.tool_block = null
        current.input_json_str = ''
      }
      if (evt.type === 'message_stop') {
        on_status?.({ ai_typing: false })
        on_end?.({ content: assistant_blocks })
      }
    }
  } catch (error) {
    on_status?.({ ai_typing: false })
    on_error?.(error)
  } finally {
    const duration_ms = Number(process.hrtime.bigint() - timer) / 1_000_000
    logger.info('anthropic_stream_finished', { duration_ms })
  }
}

export const anthropic_resume_after_tool = async ({
  messages,
  on_text,
  on_tool,
  on_status,
  on_end,
  on_error
}: { messages: Message[] } & AnthropicCallbacks) => {
  return anthropic_stream({ messages, on_text, on_tool, on_status, on_end, on_error })
}
