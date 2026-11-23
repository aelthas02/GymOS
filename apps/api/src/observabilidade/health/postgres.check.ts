import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../modules/platform/infra/prisma/prisma.service';
import type { ReadinessCheck } from './readiness';

/** Consulta pelo pool da API (gymos_app), sem abrir conexão própria a cada sonda. */
@Injectable()
export class PostgresCheck implements ReadinessCheck {
  readonly name = 'postgres';

  constructor(@Inject(PrismaService) private readonly banco: Pick<PrismaClient, '$queryRaw'>) {}

  async check(): Promise<void> {
    await this.banco.$queryRaw`SELECT 1`;
  }
}
