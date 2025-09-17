import { Controller, Get, Header } from '@nestjs/common'
import { render_metrics } from '../metrics.js'

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('content-type', 'text/plain')
  get_metrics(): string {
    return render_metrics()
  }
}
