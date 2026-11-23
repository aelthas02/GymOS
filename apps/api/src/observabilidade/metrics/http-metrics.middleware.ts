import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpMetrics, UNMATCHED_ROUTE } from './metrics';

type RoutedRequest = IncomingMessage & { baseUrl?: string; route?: { path?: unknown } };

// O Express guarda em req.route a última rota em que a requisição entrou. Os middlewares do Nest
// são montados como rotas curinga (`/api{/*splat}`), então uma requisição sem controller (404)
// termina com a rota de um middleware; os controllers da API não usam curinga.
function routeOf(req: RoutedRequest): string {
  const path = req.route?.path;
  return typeof path === 'string' && !path.includes('*')
    ? `${req.baseUrl ?? ''}${path}`
    : UNMATCHED_ROUTE;
}

/** Mede cada requisição pela rota do Nest (`/api/alunos/:id`), não pela URL com os parâmetros. */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: HttpMetrics) {}

  use(req: RoutedRequest, res: ServerResponse, next: () => void): void {
    const start = process.hrtime.bigint();
    res.once('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observe(req.method ?? 'GET', routeOf(req), res.statusCode, seconds);
    });
    next();
  }
}
