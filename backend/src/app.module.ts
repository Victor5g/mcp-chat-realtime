import { Module } from '@nestjs/common'
import { HealthController } from './http/health.controller.js'
import { MetricsController } from './http/metrics.controller.js'
import { ChatModule } from './modules/chat/chat.module.js'

@Module({
  imports: [ChatModule],
  controllers: [HealthController, MetricsController]
})
export class AppModule {}
