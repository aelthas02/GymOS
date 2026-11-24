import { createTestApp, type TestApp } from '../../testing/test-app';

describe('/metrics só na rede interna', () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  it('atende a coleta direta, sem passar pelo proxy público', async () => {
    expect((await app.get('/metrics')).status).toBe(200);
  });

  it('responde 404 quando a requisição chegou por um proxy (X-Forwarded-For)', async () => {
    const resposta = await app.get('/metrics', { 'x-forwarded-for': '203.0.113.7' });
    expect(resposta.status).toBe(404);
  });

  it('responde 404 quando o proxy informa o host público (X-Forwarded-Host)', async () => {
    const resposta = await app.get('/metrics', { 'x-forwarded-host': 'api.gymos.app' });
    expect(resposta.status).toBe(404);
  });
});
