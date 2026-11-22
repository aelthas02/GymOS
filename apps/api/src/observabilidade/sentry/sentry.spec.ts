import { BadRequestException, Controller, Get } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { loadEnv } from '../../config/env';
import { createTestApp, readEnvExample, type TestApp } from '../../testing/test-app';
import { sentryOptions } from './sentry-options';

const DSN = 'https://chave-publica@sentry.invalid/1';

function envWith(overrides: Record<string, string>) {
  return loadEnv({ ...readEnvExample(), ...overrides });
}

describe('sentryOptions', () => {
  it('desliga o Sentry quando SENTRY_DSN não está definida', () => {
    expect(sentryOptions(envWith({ SENTRY_DSN: '' }))).toBeUndefined();
  });

  it('usa APP_ENV como ambiente e SENTRY_RELEASE como release', () => {
    const options = sentryOptions(
      envWith({ SENTRY_DSN: DSN, APP_ENV: 'staging', SENTRY_RELEASE: 'gymos-api@1.4.0' }),
    );

    expect(options).toMatchObject({
      dsn: DSN,
      environment: 'staging',
      release: 'gymos-api@1.4.0',
      sendDefaultPii: false,
    });
  });
});

@Controller('falhas')
class FalhasController {
  @Get('inesperada')
  inesperada(): never {
    throw new Error('falha forçada');
  }

  @Get('esperada')
  esperada(): never {
    throw new BadRequestException('dados inválidos');
  }
}

describe('erros da API no Sentry', () => {
  const events: Sentry.ErrorEvent[] = [];
  let app: TestApp;

  beforeAll(() => {
    const options = sentryOptions(
      envWith({ SENTRY_DSN: DSN, APP_ENV: 'staging', SENTRY_RELEASE: 'gymos-api@1.4.0' }),
    );
    Sentry.init({
      ...options,
      defaultIntegrations: false,
      skipOpenTelemetrySetup: true,
      // Guarda o evento em memória e não envia nada pela rede.
      beforeSend: (event) => {
        events.push(event);
        return null;
      },
    });
  });

  afterAll(() => Sentry.close());

  beforeEach(async () => {
    events.length = 0;
    app = await createTestApp({ controllers: [FalhasController] });
  });

  afterEach(() => app.close());

  it('um erro forçado chega ao Sentry com o correlationId, o ambiente e o release', async () => {
    const response = await app.get('/api/falhas/inesperada', { 'x-correlation-id': 'erro-42' });

    expect(response.status).toBe(500);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({
      environment: 'staging',
      release: 'gymos-api@1.4.0',
      tags: { correlationId: 'erro-42' },
    });
    expect(events[0]?.exception?.values?.[0]?.value).toBe('falha forçada');
  });

  it('mantém a resposta padrão do Nest e o x-correlation-id no erro', async () => {
    const response = await app.get('/api/falhas/inesperada', { 'x-correlation-id': 'erro-43' });

    expect(response.headers.get('x-correlation-id')).toBe('erro-43');
    expect(await response.json()).toEqual({ statusCode: 500, message: 'Internal server error' });
  });

  it('não envia ao Sentry os erros HTTP esperados (4xx)', async () => {
    const response = await app.get('/api/falhas/esperada');

    expect(response.status).toBe(400);
    expect(events).toEqual([]);
  });

  it('registra o erro inesperado no log com o correlationId', async () => {
    await app.get('/api/falhas/inesperada', { 'x-correlation-id': 'erro-44' });

    const errors = app
      .logs()
      .filter((line) => line.correlationId === 'erro-44' && line['level'] === 50);
    expect(errors.length).toBeGreaterThan(0);
  });
});
