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
});
