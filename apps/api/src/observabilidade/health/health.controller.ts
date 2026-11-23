import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PostgresCheck } from './postgres.check';
import {
  READINESS_TIMEOUT_MS,
  runReadinessChecks,
  type ReadinessCheck,
  type ReadinessReport,
} from './readiness';
import { RedisCheck } from './redis.check';

/** Sondas do orquestrador; ficam fora do prefixo /api (ver configure-app.ts). */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly checks: readonly ReadinessCheck[];

  constructor(postgres: PostgresCheck, redis: RedisCheck) {
    this.checks = [postgres, redis];
  }

  /** O processo está de pé; não consulta dependências, para não reiniciar a API quando elas caem. */
  @Get('live')
  live(): { status: 'up' } {
    return { status: 'up' };
  }

  /** Pronta para receber tráfego: Postgres e Redis respondem. 503 quando algum não responde. */
  @Get('ready')
  async ready(): Promise<ReadinessReport> {
    const report = await runReadinessChecks(this.checks, READINESS_TIMEOUT_MS, (name, error) =>
      this.logger.warn(
        { dependency: name, err: error },
        `Dependência ${name} indisponível na verificação de prontidão`,
      ),
    );
    if (report.status === 'down') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
