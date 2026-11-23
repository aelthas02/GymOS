import type { INestApplication } from '@nestjs/common';
import type { Client } from 'pg';
import request from 'supertest';
import { criarAppDeTeste } from '../../../platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../../../platform/testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../../platform/testing/fabricas';
import { criarTiposPadrao, criarUsuario } from '../../testing/fabricas';
import { cookieDaResposta, CABECALHO_CSRF } from '../../testing/sessao';

const SENHA = 'senha-forte-123';

describe('CSRF no refresh e no logout (T12)', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let a: TenantCriado;

  const host = () => `${a.slug}.localhost:3000`;
  const http = () => request(app.getHttpServer());
  const entrar = async () =>
    cookieDaResposta(
      await http()
        .post('/api/auth/staff/login')
        .set('Host', host())
        .send({ email: 'csrf@a.com', senha: SENHA })
        .expect(200),
    );

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    await criarTiposPadrao(conexao, a.id);
    await criarUsuario(conexao, a.id, { chave: 'gerente', email: 'csrf@a.com', senha: SENHA });
  });

  describe.each([
    ['refresh', 200],
    ['logout', 204],
  ] as const)('POST /api/auth/staff/%s', (acao, sucesso) => {
    const chamar = (cookie: string, cabecalhos: Record<string, string>) => {
      const r = http().post(`/api/auth/staff/${acao}`).set('Host', host()).set('Cookie', cookie);
      return Object.entries(cabecalhos).reduce((req, [k, v]) => req.set(k, v), r);
    };

    it('sem x-gymos-csrf → 403', async () => {
      const cookie = await entrar();
      await chamar(cookie.par, {}).expect(403);
      // Recusado antes de tocar no token: com o cabeçalho certo, ainda vale.
      await chamar(cookie.par, { [CABECALHO_CSRF]: '1' }).expect(sucesso);
    });

    it('x-gymos-csrf com valor diferente de 1 → 403', async () => {
      const cookie = await entrar();
      await chamar(cookie.par, { [CABECALHO_CSRF]: '0' }).expect(403);
    });

    it('Sec-Fetch-Site: cross-site → 403', async () => {
      const cookie = await entrar();
      await chamar(cookie.par, { [CABECALHO_CSRF]: '1', 'Sec-Fetch-Site': 'cross-site' }).expect(
        403,
      );
    });

    it('Origin de outro host → 403', async () => {
      const cookie = await entrar();
      await chamar(cookie.par, {
        [CABECALHO_CSRF]: '1',
        Origin: 'https://evil.example.com',
      }).expect(403);
    });

    it('Origin do mesmo host em outra porta → ok', async () => {
      const cookie = await entrar();
      await chamar(cookie.par, {
        [CABECALHO_CSRF]: '1',
        Origin: `http://${a.slug}.localhost:5173`,
        'Sec-Fetch-Site': 'same-site',
      }).expect(sucesso);
    });
  });
});
