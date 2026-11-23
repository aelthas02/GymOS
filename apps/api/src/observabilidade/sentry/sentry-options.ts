import type { NodeOptions } from '@sentry/nestjs';
import type { Env } from '../../config/env';

/**
 * Dados de aluno (LGPD, inclusive de saúde): o evento leva a pilha, a rota e as tags, nunca
 * usuário, cookies, cabeçalhos, corpos, query string, variáveis locais nem dados de banco e fila.
 */
export const PRIVATE_DATA_COLLECTION: NonNullable<NodeOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  genAI: { inputs: false, outputs: false },
  stackFrameVariables: false,
};

/** Opções do Sentry da API, ou `undefined` (desligado) quando SENTRY_DSN não está definida. */
export function sentryOptions(env: Env): NodeOptions | undefined {
  if (!env.SENTRY_DSN) {
    return undefined;
  }
  return {
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    release: env.SENTRY_RELEASE,
    dataCollection: PRIVATE_DATA_COLLECTION,
  };
}
