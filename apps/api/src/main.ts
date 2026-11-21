import { Logger, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { loadEnv } from './config/env';

const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.listen(env.API_PORT);
  await signalReadyToNx(app);
  Logger.log(`API ouvindo em http://localhost:${env.API_PORT}/${GLOBAL_PREFIX}`, 'Bootstrap');
}

// O `nx serve` espera este sinal para considerar a API pronta (readyWhen.signal).
async function signalReadyToNx(app: INestApplication): Promise<void> {
  if (!process.env['NX_READY_SIGNAL_SOCKET']) {
    return;
  }
  // new Function evita que o webpack tente empacotar o import dinâmico.
  const load = new Function('s', 'return import(s)') as (
    specifier: string,
  ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
  const { emitReadySignal } = await load('@nx/js/ready-signal');
  emitReadySignal(app.getHttpServer());
}

bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : String(error), 'Bootstrap');
  process.exit(1);
});
