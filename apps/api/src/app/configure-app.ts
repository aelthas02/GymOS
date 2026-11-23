import type { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

export const GLOBAL_PREFIX = 'api';

// Sondas e coleta de métricas ficam na raiz, fora do prefixo da API.
const OUTSIDE_PREFIX = ['health/live', 'health/ready', 'metrics'];

/** Configuração comum ao main.ts e aos testes que sobem a aplicação. */
export function configureApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: OUTSIDE_PREFIX });
}
