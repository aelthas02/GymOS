import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Mesmo nome usado pelo interceptor do front (`@gymos/shared-ambiente`). */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

// Aceita os formatos comuns de id de rastreio (UUID, ULID, trace id); qualquer outro valor vindo do
// cliente é trocado por um UUID novo, para não levar texto arbitrário a logs e cabeçalhos.
const ACCEPTED_ID = /^[\w.:-]{1,128}$/;

/**
 * Reaproveita o `x-correlation-id` recebido ou gera um UUID, e devolve o valor no cabeçalho da
 * resposta. É o `genReqId` do pino-http: o valor vira `req.id` e entra em todo log da requisição.
 */
export function resolveCorrelationId(req: IncomingMessage, res: ServerResponse): string {
  const received = req.headers[CORRELATION_ID_HEADER];
  const correlationId =
    typeof received === 'string' && ACCEPTED_ID.test(received) ? received : randomUUID();
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  return correlationId;
}

export function correlationIdOf(req: IncomingMessage): string | undefined {
  return typeof req.id === 'string' ? req.id : undefined;
}
