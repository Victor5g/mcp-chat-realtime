import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { WsAdapter } from '@nestjs/platform-ws'
import { env } from './env.js'
import { logger } from './logger.js'

const configure_cors = () => {
  if (env.ws_allowed_origins.includes('*')) {
    return { origin: true, credentials: true }
  }
  return { origin: env.ws_allowed_origins, credentials: true }
}

async function bootstrap_app() {
  logger.info('bootstrap_starting')
  if (!env.anthropic_api_key) {
    logger.error('missing_env_anthropic_api_key')
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule, { logger: false })
  app.useWebSocketAdapter(new WsAdapter(app))
  app.enableCors(configure_cors())

  await app.listen(env.port)
  logger.info('http_server_listening', { port: env.port })
}

void bootstrap_app().catch(error => {
  logger.error('nest_bootstrap_failed', { error })
  process.exitCode = 1
})
