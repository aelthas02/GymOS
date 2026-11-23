import { HttpException, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { ErrorReportingFilter } from './error-reporting.filter';

function hostOf(type: string, request: unknown = {}): ArgumentsHost {
  return {
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ArgumentsHost;
}

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

describe('ErrorReportingFilter', () => {
  const delegate = vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockReturnValue(undefined);

  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear();
    delegate.mockClear();
  });

  afterAll(() => delegate.mockRestore());

  it('erro fora de HTTP é enviado sem tag de correlationId', () => {
    const erro = new Error('job falhou');

    new ErrorReportingFilter().catch(erro, hostOf('rpc'));

    expect(Sentry.captureException).toHaveBeenCalledWith(erro, undefined);
    expect(delegate).toHaveBeenCalledOnce();
  });

  it('requisição sem id envia o erro sem tags', () => {
    const erro = new Error('sem id');

    new ErrorReportingFilter().catch(erro, hostOf('http', {}));

    expect(Sentry.captureException).toHaveBeenCalledWith(erro, undefined);
  });

  it('HttpException não é enviada ao Sentry, mas segue para o filtro padrão', () => {
    new ErrorReportingFilter().catch(new HttpException('x', 400), hostOf('http', { id: 'a' }));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(delegate).toHaveBeenCalledOnce();
  });

  it('valores lançados que não são Error também são enviados', () => {
    new ErrorReportingFilter().catch('texto solto', hostOf('http', { id: 'req-9' }));

    expect(Sentry.captureException).toHaveBeenCalledWith('texto solto', {
      tags: { correlationId: 'req-9' },
    });
  });
});
