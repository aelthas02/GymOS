import { Catch, HttpException, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import type { IncomingMessage } from 'node:http';
import { correlationIdOf } from '../correlation-id';

/**
 * Envia ao Sentry os erros inesperados (o que não é HttpException), marcados com o correlationId
 * da requisição, e deixa a resposta e o log com o filtro padrão do Nest. Sem SENTRY_DSN o Sentry
 * não foi iniciado e `captureException` não faz nada.
 */
@Catch()
export class ErrorReportingFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException)) {
      const correlationId =
        host.getType() === 'http'
          ? correlationIdOf(host.switchToHttp().getRequest<IncomingMessage>())
          : undefined;
      Sentry.captureException(exception, correlationId ? { tags: { correlationId } } : undefined);
    }
    super.catch(exception, host);
  }
}
