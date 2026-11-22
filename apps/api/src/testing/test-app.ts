import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { workspaceRoot } from '@nx/devkit';
import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app/app.module';
import { configureApp } from '../app/configure-app';
import { loadEnv } from '../config/env';
import { ENV } from '../config/env.module';
import { PostgresCheck } from '../observabilidade/health/postgres.check';
import type { ReadinessCheck } from '../observabilidade/health/readiness';
import { RedisCheck } from '../observabilidade/health/redis.check';
import { LOG_DESTINATION } from '../observabilidade/logging';

export type LogLine = Record<string, unknown> & { msg?: string; correlationId?: string };

export interface TestAppOptions {
  controllers?: Type[];
  env?: Record<string, string>;
  postgres?: ReadinessCheck['check'];
  redis?: ReadinessCheck['check'];
}

export interface TestApp {
  readonly nest: INestApplication;
  get(path: string, headers?: Record<string, string>): Promise<Response>;
  logs(): LogLine[];
  close(): Promise<void>;
}

export function readEnvExample(): Record<string, string> {
  return parse(readFileSync(join(workspaceRoot, '.env.example')));
}

const responds = (): Promise<void> => Promise.resolve();

/**
 * Sobe o AppModule numa porta livre com o .env.example, os logs em memória e verificações de
 * prontidão falsas (sem Postgres nem Redis de verdade).
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const lines: string[] = [];
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(ENV)
    .useValue(loadEnv({ ...readEnvExample(), ...options.env }))
    .overrideProvider(LOG_DESTINATION)
    .useValue({ write: (line: string) => lines.push(line) })
    .overrideProvider(PostgresCheck)
    .useValue({ name: 'postgres', check: options.postgres ?? responds })
    .overrideProvider(RedisCheck)
    .useValue({ name: 'redis', check: options.redis ?? responds })
    .compile();

  const nest = moduleRef.createNestApplication({ bufferLogs: true });
  configureApp(nest);
  await nest.listen(0, '127.0.0.1');
  const baseUrl = await nest.getUrl();

  return {
    nest,
    get: (path, headers) => fetch(`${baseUrl}${path}`, { headers }),
    logs: () => lines.map((line) => JSON.parse(line) as LogLine),
    close: () => nest.close(),
  };
}
