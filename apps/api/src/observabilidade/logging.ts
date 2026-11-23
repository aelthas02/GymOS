import type { IncomingMessage } from 'node:http';
import { hostname } from 'node:os';
import type { Params } from 'nestjs-pino';
import { stdTimeFunctions, type DestinationStream } from 'pino';
import type { Env } from '../config/env';
import { resolveCorrelationId } from './correlation-id';

/** Para onde vão as linhas JSON do log; stdout fora dos testes. */
export const LOG_DESTINATION = Symbol('LOG_DESTINATION');

// Sondas e coleta de métricas chegam a cada poucos segundos: sem log de acesso para elas.
function isProbe(req: IncomingMessage): boolean {
  const path = req.url?.split('?')[0] ?? '';
  return path === '/metrics' || path.startsWith('/health/');
}

export function loggerParams(env: Env, destination: DestinationStream): Params {
  return {
    pinoHttp: [
      {
        level: env.LOG_LEVEL,
        base: {
          pid: process.pid,
          hostname: hostname(),
          service: 'api',
          environment: env.APP_ENV,
          release: env.SENTRY_RELEASE,
        },
        timestamp: stdTimeFunctions.isoTime,
        genReqId: resolveCorrelationId,
        customAttributeKeys: { reqId: 'correlationId' },
        // Os logs da aplicação levam só o correlationId; o objeto da requisição fica no log de acesso.
        quietReqLogger: true,
        customLogLevel: (_req, res, error) => {
          if (error || res.statusCode >= 500) return 'error';
          return res.statusCode >= 400 ? 'warn' : 'info';
        },
        autoLogging: { ignore: isProbe },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          censor: '[removido]',
        },
      },
      destination,
    ],
  };
}
