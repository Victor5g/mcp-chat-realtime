import { z } from 'zod'

export const tool_input_schema = z.object({
  path: z.string().min(1, 'tool_input_path_required'),
  content: z.string()
})

export const tool_result_ok_schema = z.object({
  status: z.literal('ok'),
  file_path: z.string(),
  size: z.number().nonnegative()
})

export const tool_result_denied_schema = z.object({
  status: z.literal('denied')
})

export const tool_result_error_schema = z.object({
  status: z.literal('error'),
  error_code: z.string(),
  message: z.string()
})

export const tool_result_schema = z.discriminatedUnion('status', [
  tool_result_ok_schema,
  tool_result_denied_schema,
  tool_result_error_schema
])

export const user_message_schema = z.object({
  type: z.literal('user_message'),
  data: z.object({
    text: z.string().min(1, 'text_required')
  })
})

export const tool_approval_schema = z.object({
  type: z.literal('tool_approval'),
  data: z.object({
    tool_use_id: z.string().min(1),
    approved: z.boolean()
  })
})

export const client_event_schema = z.discriminatedUnion('type', [user_message_schema, tool_approval_schema])

export const status_update_schema = z.object({
  ai_typing: z.boolean().optional(),
  tool_running: z.boolean().optional(),
  file_path: z.string().optional(),
  busy: z.boolean().optional(),
  reconnecting: z.boolean().optional(),
  error: z.string().optional()
})

export const anthropic_text_delta_schema = z.object({
  type: z.literal('text_delta'),
  text: z.string().optional()
})

export const anthropic_input_json_delta_schema = z.object({
  type: z.literal('input_json_delta'),
  partial_json: z.string().optional()
})

export const anthropic_content_block_start_schema = z.object({
  type: z.literal('content_block_start'),
  index: z.number(),
  content_block: z.object({
    type: z.enum(['text', 'tool_use']),
    id: z.string().optional(),
    name: z.string().optional()
  })
})

export const anthropic_content_block_delta_schema = z.object({
  type: z.literal('content_block_delta'),
  index: z.number().optional(),
  delta: z.union([anthropic_text_delta_schema, anthropic_input_json_delta_schema]).optional()
})

export const anthropic_content_block_stop_schema = z.object({
  type: z.literal('content_block_stop'),
  index: z.number().optional()
})

export const anthropic_message_stop_schema = z.object({
  type: z.literal('message_stop')
})

export const anthropic_error_schema = z.object({
  type: z.string()
})

export const anthropic_event_schema = z.union([
  anthropic_content_block_start_schema,
  anthropic_content_block_delta_schema,
  anthropic_content_block_stop_schema,
  anthropic_message_stop_schema,
  anthropic_error_schema
])

export type ClientEventInput = z.infer<typeof client_event_schema>
export type ToolInput = z.infer<typeof tool_input_schema>
export type ToolResult = z.infer<typeof tool_result_schema>
export type StatusUpdate = z.infer<typeof status_update_schema>
export type AnthropicEvent = z.infer<typeof anthropic_event_schema>
