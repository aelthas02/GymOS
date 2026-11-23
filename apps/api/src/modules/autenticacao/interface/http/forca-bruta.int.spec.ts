import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import request from 'supertest';
import { criarAppDeTeste } from '../../../platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../../../platform/testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../../platform/testing/fabricas';
import { criarCredencialDeAluno, criarTiposPadrao, criarUsuario } from '../../testing/fabricas';

const SENHA = 'senha-forte-123';

describe('proteção contra força bruta (T12)', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;

  const hostDe = (t: TenantCriado) => `${t.slug}.localhost:3000`;
  const http = () => request(app.getHttpServer());
  const staff = (t: TenantCriado, login: string, senha: string) =>
    http().post('/api/auth/staff/login').set('Host', hostDe(t)).send({ email: login, senha });
  // O contador do IP é por tenant, então cada teste usa o seu para não herdar falhas dos outros.
  const novoTenant = async (): Promise<TenantCriado> => {
    const t = await criarTenant(conexao);
    await criarTiposPadrao(conexao, t.id);
    return t;
  };

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    conexao = await banco.conectarComoApp();
  });

  it('o IP é bloqueado na 21ª falha em contas diferentes, até com a senha certa', async () => {
    const t = await novoTenant();
    await criarUsuario(conexao, t.id, { chave: 'gerente', email: 'certo@t.com', senha: SENHA });

    for (let i = 0; i < 20; i++) {
      await staff(t, `fantasma${i}@t.com`, 'senha-errada-1').expect(401);
    }
    await staff(t, 'fantasma99@t.com', 'senha-errada-1').expect(429);
    await staff(t, 'certo@t.com', SENHA).expect(429);
  });

  it('login certo zera a conta mas não o IP', async () => {
    const t = await novoTenant();
    await criarUsuario(conexao, t.id, { chave: 'gerente', email: 'zera@t.com', senha: SENHA });

    // 4 falhas (limite 5), acerto zera a conta; mais 4 falhas ainda não bloqueiam.
    for (let i = 0; i < 4; i++) await staff(t, 'zera@t.com', 'errada-123').expect(401);
    await staff(t, 'zera@t.com', SENHA).expect(200);
    for (let i = 0; i < 4; i++) await staff(t, 'zera@t.com', 'errada-123').expect(401);
    await staff(t, 'zera@t.com', SENHA).expect(200);

    // O IP guardou as 8 falhas: mais 12 em outras contas chegam a 20 e fecham o IP.
    for (let i = 0; i < 12; i++) await staff(t, `outra${i}@t.com`, 'errada-123').expect(401);
    await staff(t, 'zera@t.com', SENHA).expect(429);
  });

  it('as contas são separadas por tenant: 5 falhas em A não bloqueiam a mesma conta em B', async () => {
    const ta = await novoTenant();
    const tb = await novoTenant();
    for (const t of [ta, tb]) {
      await criarUsuario(conexao, t.id, { chave: 'gerente', email: 'mesma@x.com', senha: SENHA });
    }

    for (let i = 0; i < 5; i++) await staff(ta, 'mesma@x.com', 'errada-123').expect(401);
    await staff(ta, 'mesma@x.com', SENHA).expect(429);
    await staff(tb, 'mesma@x.com', SENHA).expect(200);
  });

  it('primeiro acesso do aluno com código errado conta tentativas e bloqueia', async () => {
    const t = await novoTenant();
    await criarCredencialDeAluno(conexao, t.id, {
      alunoId: randomUUID(),
      email: 'novo@t.com',
      senha: SENHA,
    });
    const primeiroAcesso = (codigo: string) =>
      http()
        .post('/api/auth/aluno/primeiro-acesso')
        .set('Host', hostDe(t))
        .send({ identificador: 'novo@t.com', codigo, senha: 'senha-nova-123' });

    for (let i = 0; i < 5; i++) await primeiroAcesso('CODIGO00').expect(401);
    await primeiroAcesso('CODIGO00').expect(429);
    // O contador é o mesmo do login: a conta está bloqueada nos dois caminhos.
    await http()
      .post('/api/auth/aluno/login')
      .set('Host', hostDe(t))
      .send({ identificador: 'novo@t.com', senha: SENHA })
      .expect(429);
  });

  it('bloqueio do aluno responde 429 também para a senha certa', async () => {
    const t = await novoTenant();
    await criarCredencialDeAluno(conexao, t.id, {
      alunoId: randomUUID(),
      email: 'luz@t.com',
      senha: SENHA,
    });
    const entrar = (senha: string) =>
      http()
        .post('/api/auth/aluno/login')
        .set('Host', hostDe(t))
        .send({ identificador: 'luz@t.com', senha });

    for (let i = 0; i < 5; i++) await entrar('errada-123').expect(401);
    await entrar(SENHA).expect(429);
  });
});
