import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';

describe('resolução do tenant por subdomínio', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let tenant: TenantCriado;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    tenant = await criarTenant(await banco.conectarComoApp(), { corDestaque: '#3AA6F0' });
  });

  afterEach(() => vi.restoreAllMocks());

  it('Host de subdomínio desconhecido responde 404 antes de abrir transação', async () => {
    const transacao = vi.spyOn(app.get(PrismaService), '$transaction');

    await request(app.getHttpServer())
      .get('/api/public/tenant')
      .set('Host', 'desconhecida.localhost:3000')
      .expect(404);

    expect(transacao).not.toHaveBeenCalled();
  });

  it('Host do subdomínio de um tenant devolve a identidade pública', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/public/tenant')
      .set('Host', `${tenant.slug}.localhost:3000`)
      .expect(200);

    expect(resposta.body).toEqual({
      nome: tenant.nome,
      corDestaque: '#3AA6F0',
      logotipoUrl: null,
    });
  });
});
