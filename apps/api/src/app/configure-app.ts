import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { ENV } from '../config/env.module';
import type { Env } from '../config/env';

export const GLOBAL_PREFIX = 'api';

// Sondas e coleta de métricas ficam na raiz, fora do prefixo da API.
const OUTSIDE_PREFIX = ['health/live', 'health/ready', 'metrics'];

/** Configuração comum ao main.ts e aos testes que sobem a aplicação. */
export function configureApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  const { TRUST_PROXY_HOPS } = app.get<Env>(ENV, { strict: false });
  (app as NestExpressApplication).set('trust proxy', TRUST_PROXY_HOPS);
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: OUTSIDE_PREFIX });
}
