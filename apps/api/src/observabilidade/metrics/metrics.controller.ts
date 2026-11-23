import { Controller, Get, Header } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsRegistry } from './metrics';

/**
 * Coleta do Prometheus, fora do prefixo /api. Não deve ser publicada na internet: o deploy (T03)
 * expõe /metrics só na rede interna.
 */
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
