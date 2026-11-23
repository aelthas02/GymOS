import { Controller, Get, Logger } from '@nestjs/common';
import { createTestApp, type TestApp } from '../testing/test-app';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

@Controller('eco')
class EcoController {
  private readonly logger = new Logger('Eco');

  @Get()
  responder(): { ok: boolean } {
    this.logger.log('dentro da requisição');
    return { ok: true };
  }
}

describe('correlationId das requisições', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp({ controllers: [EcoController] });
  });

  afterEach(() => app.close());

  it('gera um UUID quando a requisição chega sem x-correlation-id', async () => {
    const response = await app.get('/api/eco');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-correlation-id')).toMatch(UUID_V4);
  });

  it('reaproveita o x-correlation-id recebido', async () => {
    const response = await app.get('/api/eco', { 'x-correlation-id': 'pedido-123' });

    expect(response.headers.get('x-correlation-id')).toBe('pedido-123');
  });

  it('inclui o correlationId nos logs da aplicação e no log da resposta', async () => {
    const response = await app.get('/api/eco');
    const correlationId = response.headers.get('x-correlation-id');

    const messages = app
      .logs()
      .filter((line) => line.correlationId === correlationId)
      .map((line) => line.msg);
    expect(messages).toEqual(expect.arrayContaining(['dentro da requisição', 'request completed']));
  });

  it('gera um correlationId diferente para cada requisição sem cabeçalho', async () => {
    const first = await app.get('/api/eco');
    const second = await app.get('/api/eco');

    expect(first.headers.get('x-correlation-id')).not.toBe(second.headers.get('x-correlation-id'));
  });

  it.each([
    ['texto com espaço', 'pedido 123'],
    ['mais de 128 caracteres', 'a'.repeat(129)],
    ['símbolos fora do formato aceito', 'x;<script>'],
  ])('troca por um UUID novo o x-correlation-id inválido: %s', async (_caso, invalido) => {
    const response = await app.get('/api/eco', { 'x-correlation-id': invalido });

    const correlationId = response.headers.get('x-correlation-id');
    expect(correlationId).toMatch(UUID_V4);
    expect(correlationId).not.toBe(invalido);
  });

  it('aceita o x-correlation-id com exatamente 128 caracteres', async () => {
    const limite = 'a'.repeat(128);

    const response = await app.get('/api/eco', { 'x-correlation-id': limite });

    expect(response.headers.get('x-correlation-id')).toBe(limite);
  });

  it('devolve o x-correlation-id também nas respostas de /health/* e /metrics', async () => {
    const live = await app.get('/health/live', { 'x-correlation-id': 'sonda-1' });
    const metrics = await app.get('/metrics', { 'x-correlation-id': 'sonda-2' });

    expect(live.headers.get('x-correlation-id')).toBe('sonda-1');
    expect(metrics.headers.get('x-correlation-id')).toBe('sonda-2');
  });
});
