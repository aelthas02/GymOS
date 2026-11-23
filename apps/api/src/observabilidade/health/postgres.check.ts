import { Inject, Injectable } from '@nestjs/common';
import { Client } from 'pg';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { READINESS_TIMEOUT_MS, type ReadinessCheck } from './readiness';

/**
 * Abre uma conexão curta a cada sonda. Quando o Prisma chegar (T11), pode passar a consultar pelo
 * pool da aplicação.
 */
@Injectable()
export class PostgresCheck implements ReadinessCheck {
  readonly name = 'postgres';

  constructor(@Inject(ENV) private readonly env: Env) {}

  async check(): Promise<void> {
    const client = new Client({
      connectionString: this.env.DATABASE_URL,
      connectionTimeoutMillis: READINESS_TIMEOUT_MS,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
