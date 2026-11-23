import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { destination } from 'pino';
import { ENV } from '../config/env.module';
import { HealthController } from './health/health.controller';
import { PostgresCheck } from './health/postgres.check';
import { RedisCheck } from './health/redis.check';
import { LOG_DESTINATION, loggerParams } from './logging';
import { HttpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { MetricsController } from './metrics/metrics.controller';
import { HttpMetrics, MetricsRegistry, QueueMetrics } from './metrics/metrics';
import { ErrorReportingFilter } from './sentry/error-reporting.filter';

/**
 * Logs JSON com correlationId, health checks, métricas Prometheus e envio de erros ao Sentry. O
 * Sentry em si é iniciado em instrument.ts, antes do Nest.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      providers: [{ provide: LOG_DESTINATION, useFactory: () => destination(1) }],
      inject: [ENV, LOG_DESTINATION],
      useFactory: loggerParams,
    }),
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    PostgresCheck,
    RedisCheck,
    MetricsRegistry,
    HttpMetrics,
    QueueMetrics,
    { provide: APP_FILTER, useClass: ErrorReportingFilter },
  ],
  exports: [QueueMetrics],
})
export class ObservabilidadeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpMetricsMiddleware).forRoutes('*');
  }
}
