import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsRegistry } from './metrics';
import { SomenteRedeInternaGuard } from './somente-rede-interna.guard';

/**
 * Coleta do Prometheus, fora do prefixo /api. Não é publicada na internet: o guard recusa quem
 * chegou pelo proxy público e o deploy (docs/runbooks/deploy.md) só roteia /metrics na rede interna.
 */
@UseGuards(SomenteRedeInternaGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsRegistry) {}

  @Get()
  @Header('Content-Type', Registry.PROMETHEUS_CONTENT_TYPE)
  @Header('Cache-Control', 'no-store')
  scrape(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
