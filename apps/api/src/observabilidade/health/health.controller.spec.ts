import { createTestApp, type TestApp } from '../../testing/test-app';

const offline = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:6379'));

describe('health checks', () => {
  let app: TestApp | undefined;

  afterEach(() => app?.close());

  it('/health/live responde 200 sem consultar as dependências', async () => {
    const postgres = vi.fn(offline);
    const redis = vi.fn(offline);
    app = await createTestApp({ postgres, redis });

    const response = await app.get('/health/live');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'up' });
    expect(postgres).not.toHaveBeenCalled();
    expect(redis).not.toHaveBeenCalled();
  });

  it('/health/ready responde 200 quando Postgres e Redis respondem', async () => {
    app = await createTestApp();

    const response = await app.get('/health/ready');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'up',
      checks: { postgres: 'up', redis: 'up' },
    });
  });

  it('/health/ready responde 503 quando o Redis está fora', async () => {
    app = await createTestApp({ redis: offline });

    const response = await app.get('/health/ready');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'down',
      checks: { postgres: 'up', redis: 'down' },
    });
  });

  it('/health/ready responde 503 quando o Postgres está fora', async () => {
    app = await createTestApp({ postgres: offline });

    const response = await app.get('/health/ready');

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ checks: { postgres: 'down', redis: 'up' } });
  });

  it('não expõe a mensagem de erro da dependência na resposta', async () => {
    app = await createTestApp({ redis: offline });

    const response = await app.get('/health/ready');

    expect(await response.text()).not.toContain('ECONNREFUSED');
  });

  it('as rotas de saúde ficam fora do prefixo /api', async () => {
    app = await createTestApp();

    expect((await app.get('/api/health/live')).status).toBe(404);
  });
});
