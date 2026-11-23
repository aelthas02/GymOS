import { Controller, Get, NotFoundException } from '@nestjs/common';
import { createTestApp, type TestApp } from '../testing/test-app';

@Controller('logs')
class LogsController {
  @Get('nao-encontrado')
  naoEncontrado(): never {
    throw new NotFoundException('sumiu');
  }

  @Get('falha')
  falha(): never {
    throw new Error('falha forçada');
  }

  @Get('ok')
  ok(): { ok: boolean } {
    return { ok: true };
  }
}

describe('log de acesso', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp({ controllers: [LogsController] });
  });

  afterEach(() => app.close());

  const accessLogs = (correlationId: string) =>
    app
      .logs()
      .filter((line) => line.correlationId === correlationId && line.msg === 'request completed');

  it('registra o erro 4xx como warn, com o correlationId', async () => {
    await app.get('/api/logs/nao-encontrado', { 'x-correlation-id': 'log-404' });

    const lines = app.logs().filter((line) => line.correlationId === 'log-404');
    expect(lines.length).toBeGreaterThan(0);
    expect(accessLogs('log-404')).toEqual([
      expect.objectContaining({ level: 40, res: expect.objectContaining({ statusCode: 404 }) }),
    ]);
  });

  it('registra o erro 5xx como error, com o correlationId, mesmo sem Sentry iniciado', async () => {
    const response = await app.get('/api/logs/falha', { 'x-correlation-id': 'log-500' });

    expect(response.status).toBe(500);
    const lines = app.logs().filter((line) => line.correlationId === 'log-500');
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 50, msg: 'falha forçada' }),
        expect.objectContaining({ level: 50, msg: 'request errored' }),
      ]),
    );
  });

  it('registra o sucesso como info', async () => {
    await app.get('/api/logs/ok', { 'x-correlation-id': 'log-200' });

    expect(accessLogs('log-200')).toEqual([expect.objectContaining({ level: 30 })]);
  });

  it('não gera log de acesso para /health/* nem /metrics', async () => {
    await app.get('/health/live', { 'x-correlation-id': 'sonda-live' });
    await app.get('/health/ready', { 'x-correlation-id': 'sonda-ready' });
    await app.get('/metrics?formato=texto', { 'x-correlation-id': 'sonda-metrics' });

    const ids = ['sonda-live', 'sonda-ready', 'sonda-metrics'];
    expect(app.logs().filter((line) => ids.includes(line.correlationId ?? ''))).toEqual([]);
  });

  it('remove authorization e cookie do log de acesso', async () => {
    await app.get('/api/logs/ok', {
      'x-correlation-id': 'log-redacao',
      authorization: 'Bearer segredo-123',
      cookie: 'sessao=segredo-456',
    });

    const [line] = accessLogs('log-redacao');
    expect(line).toBeDefined();
    const raw = JSON.stringify(line);
    expect(raw).not.toContain('segredo-123');
    expect(raw).not.toContain('segredo-456');
  });
});
