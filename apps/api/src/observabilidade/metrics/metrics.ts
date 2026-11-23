import { Injectable, Logger } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

/** Rótulo das requisições que não casaram com nenhuma rota (404), para não explodir a cardinalidade. */
export const UNMATCHED_ROUTE = '<sem rota>';

const HTTP_LABELS = ['method', 'route', 'status_code'] as const;
type HttpLabel = (typeof HTTP_LABELS)[number];

/** Registro próprio da API, exposto em /metrics, com as métricas padrão do processo Node. */
@Injectable()
export class MetricsRegistry {
  readonly registry = new Registry();

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}

@Injectable()
export class HttpMetrics {
  private readonly duration: Histogram<HttpLabel>;
  private readonly serverErrors: Counter<HttpLabel>;

  constructor({ registry }: MetricsRegistry) {
    this.duration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duração das requisições HTTP, por rota do Nest',
      labelNames: HTTP_LABELS,
      registers: [registry],
    });
    this.serverErrors = new Counter({
      name: 'http_server_errors_total',
      help: 'Respostas HTTP com status 5xx, por rota do Nest',
      labelNames: HTTP_LABELS,
      registers: [registry],
    });
  }

  observe(method: string, route: string, statusCode: number, seconds: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.duration.observe(labels, seconds);
    if (statusCode >= 500) {
      this.serverErrors.inc(labels);
    }
  }
}

/** Quantidade de jobs por estado (waiting, active, delayed, failed…), como o `getJobCounts` do BullMQ. */
export type QueueJobCounts = Record<string, number>;

/**
 * Cada fila se registra aqui (T13a) e a contagem é lida a cada coleta do Prometheus. Uma fila que
 * falha na leitura fica de fora daquela coleta, sem derrubar as outras métricas.
 */
@Injectable()
export class QueueMetrics {
  private readonly logger = new Logger(QueueMetrics.name);
  private readonly sources = new Map<string, () => Promise<QueueJobCounts>>();

  constructor({ registry }: MetricsRegistry) {
    const sources = this.sources;
    const logger = this.logger;
    new Gauge({
      name: 'queue_jobs',
      help: 'Jobs por fila e estado',
      labelNames: ['queue', 'state'],
      registers: [registry],
      async collect() {
        this.reset();
        for (const [queue, readCounts] of sources) {
          try {
            for (const [state, count] of Object.entries(await readCounts())) {
              this.set({ queue, state }, count);
            }
          } catch (error) {
            logger.warn({ queue, err: error }, `Não foi possível ler a contagem da fila ${queue}`);
          }
        }
      },
    });
  }

  /** Registra a fila e devolve a função que a remove. */
  register(queue: string, readCounts: () => Promise<QueueJobCounts>): () => void {
    this.sources.set(queue, readCounts);
    return () => this.sources.delete(queue);
  }
}
