import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  get_health() {
    return { ok: true }
  }
}
