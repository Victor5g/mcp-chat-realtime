import { gen_id, now_iso } from '../../../utils.js'
import type {
  AssistantContentBlock,
  Message,
  PendingToolCall,
  ToolResultPayload
} from './types.js'

export class ChatSession {
  readonly session_id: string
  readonly history: Message[]
  pending_tool: PendingToolCall | null
  active: boolean
  constructor() {
    this.session_id = gen_id()
    this.history = []
    this.pending_tool = null
    this.active = false
  }

  add_user_message(text: string) {
    this.history.push({ role: 'user', content: [{ type: 'text', text }] })
  }

  add_assistant_blocks(blocks: AssistantContentBlock[]) {
    this.history.push({ role: 'assistant', content: blocks })
  }

  record_tool_result(tool_use_id: string, result: ToolResultPayload) {
    const content = JSON.stringify(result)
    this.history.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id, content }] })
  }

  set_pending_tool(tool: PendingToolCall) {
    this.pending_tool = tool
  }

  clear_pending_tool() {
    this.pending_tool = null
  }

  to_public_state() {
    return {
      session_id: this.session_id,
      history: this.history,
      pending_tool: this.pending_tool,
      active: this.active,
      updated_at: now_iso()
    }
  }
}
