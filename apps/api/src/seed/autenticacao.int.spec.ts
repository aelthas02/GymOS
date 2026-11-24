import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../modules/platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../modules/platform/testing/banco-de-teste';
import { EQUIPE_DO_SEED, SENHA_DO_SEED, seedDaAutenticacao } from './autenticacao';
import { contextoDoSeed } from './runner';
import { ACADEMIA_RITMO, seedDaPlataforma } from './plataforma';

describe('seed da autenticação', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
  });

  it('sem o tenant Ritmo, falha com mensagem clara', async () => {
    await expect(seedDaAutenticacao.executar(app, contextoDoSeed(app))).rejects.toThrow(
      /seed da plataforma/,
    );
  });

  it('cria os tipos padrão e a equipe da Ritmo, que entra com a senha do seed', async () => {
    await seedDaPlataforma.executar(app, contextoDoSeed(app));
    await seedDaAutenticacao.executar(app, contextoDoSeed(app));
    await seedDaAutenticacao.executar(app, contextoDoSeed(app));

    const conexao = await banco.conectarComoApp();
    const { rows } = await conexao.query<{ total: string }>(
      'SELECT count(*) AS total FROM gymos_tenant_por_slug($1)',
      [ACADEMIA_RITMO.slug],
    );
    expect(rows[0]?.total).toBe('1');

    for (const pessoa of EQUIPE_DO_SEED) {
      const login = await request(app.getHttpServer())
        .post('/api/auth/staff/login')
        .set('Host', `${ACADEMIA_RITMO.slug}.localhost`)
        .send({ email: pessoa.email, senha: SENHA_DO_SEED })
        .expect(200);
      const me = await request(app.getHttpServer())
        .get('/api/me')
        .set('Host', `${ACADEMIA_RITMO.slug}.localhost`)
        .auth((login.body as { accessToken: string }).accessToken, { type: 'bearer' })
        .expect(200);
      expect(me.body).toMatchObject({ nome: pessoa.nome, email: pessoa.email });
    }
  });
});
