export type ToolName = 'create_file'

export interface CreateFileToolInput {
  path: string
  content: string
}

export type TextContentBlock = {
  type: 'text'
  text: string
}

export type ToolUseContentBlock = {
  type: 'tool_use'
  id: string
  name: ToolName
  input: CreateFileToolInput
}

export type ToolResultContentBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export type AssistantContentBlock = TextContentBlock | ToolUseContentBlock
export type UserContentBlock = TextContentBlock | ToolResultContentBlock

export type AssistantMessage = {
  role: 'assistant'
  content: AssistantContentBlock[]
}

export type UserMessage = {
  role: 'user'
  content: UserContentBlock[]
}

export type Message = AssistantMessage | UserMessage

export type PendingToolCall = ToolUseContentBlock

export interface ToolResultOk {
  status: 'ok'
  file_path: string
  size: number
}

export interface ToolResultDenied {
  status: 'denied'
}

export interface ToolResultError {
  status: 'error'
  error_code: string
  message: string
}

export type ToolResultPayload = ToolResultOk | ToolResultDenied | ToolResultError

export type StatusUpdateData = {
  ai_typing?: boolean
  tool_running?: boolean
  file_path?: string
  busy?: boolean
  reconnecting?: boolean
  error?: string
}

export type ServerEvent =
  | { type: 'session_created'; data: { session_id: string } }
  | { type: 'status_update'; data: StatusUpdateData }
  | { type: 'ai_chunk'; data: { text: string } }
  | { type: 'assistant_message_completed'; data?: { reason: 'ok' | 'error' } }
  | { type: 'tool_request'; data: PendingToolCall }
  | { type: 'tool_chunk'; data: { chunk: string } }
  | { type: 'error'; data: { message: string; detail?: string } }

export type ClientEvent =
  | { type: 'user_message'; data: { text: string } }
  | { type: 'tool_approval'; data: { tool_use_id: string; approved: boolean } }

export type AnthropicToolSchema = {
  name: ToolName
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}
