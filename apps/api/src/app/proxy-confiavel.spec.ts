import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createTestApp, type TestApp } from '../testing/test-app';
import { Publica } from '../modules/platform/interface/http/acesso-publico';

@Controller('quem-sou-eu')
@Publica()
class IpDeTesteController {
  @Get()
  ip(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }
}

describe('trust proxy da API', () => {
  let app: TestApp | undefined;
  afterEach(() => app?.close());

  async function ipVisto(env: Record<string, string>): Promise<string | undefined> {
    app = await createTestApp({ controllers: [IpDeTesteController], env });
    const resposta = await app.get('/api/quem-sou-eu', { 'x-forwarded-for': '203.0.113.7' });
    return ((await resposta.json()) as { ip?: string }).ip;
  }

  it('sem proxy confiável, ignora o X-Forwarded-For (o IP é o da conexão)', async () => {
    expect(await ipVisto({ TRUST_PROXY_HOPS: '0' })).not.toBe('203.0.113.7');
  });

  it('com um salto confiável, o IP do cliente vem do X-Forwarded-For', async () => {
    expect(await ipVisto({ TRUST_PROXY_HOPS: '1' })).toBe('203.0.113.7');
  });
});
