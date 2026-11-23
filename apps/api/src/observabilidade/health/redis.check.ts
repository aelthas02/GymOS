import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { READINESS_TIMEOUT_MS, type ReadinessCheck } from './readiness';

/** Abre uma conexão curta a cada sonda, sem novas tentativas: quem repete é a sonda. */
@Injectable()
export class RedisCheck implements ReadinessCheck {
  readonly name = 'redis';

  constructor(@Inject(ENV) private readonly env: Env) {}

  async check(): Promise<void> {
    const client = new Redis(this.env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: READINESS_TIMEOUT_MS,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    // A falha chega pela promessa do connect; sem este ouvinte o ioredis a imprime no console.
    client.on('error', () => undefined);
    try {
      await client.connect();
      await client.ping();
    } finally {
      client.disconnect();
    }
  }
}
