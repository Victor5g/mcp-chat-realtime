import { IncomingMessage } from 'http'
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets'
import type { RawData, WebSocket } from 'ws'
import { ChatSession } from '../domain/chat_session.js'
import type { ClientEvent, ServerEvent } from '../domain/types.js'
import { env } from '../../../env.js'
import { logger } from '../../../logger.js'
import { increment_counter } from '../../../metrics.js'
import { client_event_schema } from '../domain/schemas.js'
import { Process_client_event_usecase } from '../usecases/process_client_event.usecase.js'
import { anthropic_resume_after_tool, anthropic_stream } from '../services/anthropic_service.js'
import { stream_create_file } from '../services/mcp_tool_service.js'

type Session_entry = {
  session: ChatSession
  usecase: Process_client_event_usecase
}

@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly sessions = new Map<WebSocket, Session_entry>()

  handleConnection(client: WebSocket, request: IncomingMessage) {
    const origin = request.headers.origin || ''
    if (!this.origin_allowed(origin)) {
      client.close(1008, 'origin_not_allowed')
      return
    }

    const session = new ChatSession()
    const send_event = (event: ServerEvent) => this.safe_send(client, event)
    const usecase = new Process_client_event_usecase(session, send_event, {
      anthropic_resume: anthropic_resume_after_tool,
      anthropic_stream,
      stream_create_file
    })

    this.sessions.set(client, { session, usecase })
    increment_counter('ws_connections_total')
    logger.info('ws_connection_opened', { session_id: session.session_id, origin })

    send_event({ type: 'session_created', data: { session_id: session.session_id } })

    client.on('message', raw => {
      void this.handle_message(client, raw)
    })

    client.on('error', error => {
      logger.warn('ws_socket_error', { error, session_id: session.session_id })
    })
  }

  handleDisconnect(client: WebSocket) {
    const entry = this.sessions.get(client)
    if (!entry) return
    this.sessions.delete(client)
    increment_counter('ws_disconnects_total')
    logger.info('ws_connection_closed', { session_id: entry.session.session_id })
  }

  private async handle_message(client: WebSocket, raw: RawData) {
    const entry = this.sessions.get(client)
    if (!entry) return
    try {
      const parsed = JSON.parse(raw.toString())
      const validation = client_event_schema.safeParse(parsed)
      if (!validation.success) {
        this.safe_send(client, { type: 'error', data: { message: 'invalid_payload' } })
        return
      }
      const event: ClientEvent = validation.data
      try {
        await entry.usecase.handle_event(event)
      } catch (error) {
        logger.error('ws_usecase_error', { error, session_id: entry.session.session_id })
        this.safe_send(client, { type: 'error', data: { message: 'internal_error' } })
      }
    } catch (error) {
      logger.warn('ws_message_parse_failed', { error })
      this.safe_send(client, { type: 'error', data: { message: 'invalid_json' } })
    }
  }

  private origin_allowed(origin: string) {
    if (env.ws_allowed_origins.includes('*')) return true
    if (!origin) return false
    return env.ws_allowed_origins.includes(origin)
  }

  private safe_send(client: WebSocket, payload: ServerEvent) {
    try {
      client.send(JSON.stringify(payload))
    } catch (error) {
      logger.warn('ws_send_failed', { error, payload_type: payload.type })
    }
  }
}
