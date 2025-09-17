import { describe, expect, it } from 'vitest'
import { client_event_schema } from '../modules/chat/domain/schemas.js'

describe('client_event_schema', () => {
  it('accepts valid user messages', () => {
    const data = { type: 'user_message', data: { text: 'hello' } }
    const result = client_event_schema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects empty user messages', () => {
    const data = { type: 'user_message', data: { text: '' } }
    const result = client_event_schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects invalid tool approval payload', () => {
    const data = { type: 'tool_approval', data: { approved: 'yes' } }
    const result = client_event_schema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
