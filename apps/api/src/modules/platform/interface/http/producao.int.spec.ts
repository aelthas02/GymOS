import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';

describe('ambiente de produção', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let a: TenantCriado;
  let b: TenantCriado;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco, { ambiente: 'production', dominioBase: 'gymos.app' });
    const conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    b = await criarTenant(conexao);
  });

  it('x-tenant é ignorado: sem subdomínio no Host responde 404', async () => {
    await request(app.getHttpServer())
      .get('/api/public/tenant')
      .set('Host', 'gymos.app')
      .set('x-tenant', a.slug)
      .expect(404);
  });

  it('x-tenant não sobrepõe o tenant do Host', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/public/tenant')
      .set('Host', `${b.slug}.gymos.app`)
      .set('x-tenant', a.slug)
      .expect(200);

    expect(resposta.body).toMatchObject({ nome: b.nome });
  });

  it('o Host do subdomínio resolve, com maiúsculas e porta', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/public/tenant')
      .set('Host', `${a.slug.toUpperCase()}.gymos.app:443`)
      .expect(200);

    expect(resposta.body).toMatchObject({ nome: a.nome });
  });

  it('o provedor de webhook fake responde 404, com e sem slug', async () => {
    await request(app.getHttpServer())
      .post('/api/webhooks/fake')
      .send({ idExterno: 'qualquer', evento: 'pago' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/webhooks/fake/${a.slug}`)
      .send({ idExterno: 'qualquer', evento: 'pago' })
      .expect(404);
  });
});
