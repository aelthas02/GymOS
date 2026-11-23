import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import request from 'supertest';
import { criarAppDeTeste } from '../../../platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../../../platform/testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../../platform/testing/fabricas';
import { EnvioDeEmail } from '../../application/portas';
import { EnvioDeEmailFake } from '../../infra/email/envio-de-email.fake';
import { criarCredencialDeAluno, criarTiposPadrao, criarUsuario } from '../../testing/fabricas';
import { cookieDaResposta, CABECALHO_CSRF } from '../../testing/sessao';

const SENHA = 'senha-forte-123';
const DIA = 24 * 60 * 60 * 1000;

describe('refresh: reuso, expiração e revogação (T12)', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let a: TenantCriado;
  let email: EnvioDeEmailFake;

  const host = () => `${a.slug}.localhost:3000`;
  const http = () => request(app.getHttpServer());
  const loginStaff = async (login: string) =>
    cookieDaResposta(
      await http()
        .post('/api/auth/staff/login')
        .set('Host', host())
        .send({ email: login, senha: SENHA })
        .expect(200),
    );
  const loginAluno = async (identificador: string) =>
    cookieDaResposta(
      await http()
        .post('/api/auth/aluno/login')
        .set('Host', host())
        .send({ identificador, senha: SENHA })
        .expect(200),
    );
  const renovar = (rota: 'staff' | 'aluno', cookie: string, relogio?: string) => {
    const r = http()
      .post(`/api/auth/${rota}/refresh`)
      .set('Host', host())
      .set(CABECALHO_CSRF, '1')
      .set('Cookie', cookie);
    return relogio ? r.set('x-relogio', relogio) : r;
  };
  const futuro = (ms: number) => new Date(Date.now() + ms).toISOString();

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    email = app.get(EnvioDeEmail) as EnvioDeEmailFake;
    conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    await criarTiposPadrao(conexao, a.id);
    for (const login of ['u1@a.com', 'u2@a.com', 'u3@a.com', 'u4@a.com', 'u5@a.com']) {
      await criarUsuario(conexao, a.id, { chave: 'gerente', email: login, senha: SENHA });
    }
    for (const login of ['al1@a.com', 'al2@a.com']) {
      await criarCredencialDeAluno(conexao, a.id, {
        alunoId: randomUUID(),
        email: login,
        senha: SENHA,
      });
    }
  });

  it('dois refresh concorrentes com o mesmo cookie: no máximo um 200 e a família é revogada', async () => {
    const cookie = await loginStaff('u1@a.com');

    const respostas = await Promise.all([
      renovar('staff', cookie.par),
      renovar('staff', cookie.par),
    ]);
    const status = respostas.map((r) => r.status);

    expect(status.filter((s) => s === 200).length).toBeLessThanOrEqual(1);
    expect(status.filter((s) => s === 401).length).toBeGreaterThanOrEqual(1);
    // O sucessor emitido (se houve) também morreu, e o cookie original segue morto.
    for (const r of respostas.filter((x) => x.status === 200)) {
      await renovar('staff', cookieDaResposta(r).par).expect(401);
    }
    await renovar('staff', cookie.par).expect(401);
  });

  it('refresh do painel expirado (> 7 dias) é recusado; dentro do prazo renova', async () => {
    const cookie = await loginStaff('u2@a.com');
    await renovar('staff', cookie.par, futuro(8 * DIA)).expect(401);

    const outro = await loginStaff('u2@a.com');
    await renovar('staff', outro.par, futuro(6 * DIA)).expect(200);
  });

  it('refresh do aluno expirado (> 30 dias) é recusado; com 8 dias ainda renova', async () => {
    const cookie = await loginAluno('al1@a.com');
    await renovar('aluno', cookie.par, futuro(31 * DIA)).expect(401);

    const outro = await loginAluno('al1@a.com');
    await renovar('aluno', outro.par, futuro(8 * DIA)).expect(200);
  });

  it('cookie do aluno no /staff/refresh não renova (e o contrário)', async () => {
    const aluno = await loginAluno('al2@a.com');
    const staff = await loginStaff('u3@a.com');

    await renovar('staff', aluno.par).expect(401);
    // Mesmo com o nome do cookie trocado, o token é de outro público e é recusado.
    await renovar('staff', aluno.par.replace('gymos_rt_aluno', 'gymos_rt_staff')).expect(401);
    await renovar('aluno', staff.par.replace('gymos_rt_staff', 'gymos_rt_aluno')).expect(401);
  });

  it('após redefinir a senha, os refresh antigos morrem', async () => {
    const antigo = await loginStaff('u4@a.com');
    const outroDispositivo = await loginStaff('u4@a.com');
    await http()
      .post('/api/auth/staff/esqueci-senha')
      .set('Host', host())
      .send({ email: 'u4@a.com' })
      .expect(204);
    const link = /https?:\/\/\S+/.exec(email.ultimaPara('u4@a.com')?.texto ?? '')?.[0] ?? '';
    const token = new URL(link).searchParams.get('token') ?? '';

    await http()
      .post('/api/auth/staff/redefinir-senha')
      .set('Host', host())
      .send({ token, senha: 'nova-senha-456' })
      .expect(204);

    await renovar('staff', antigo.par).expect(401);
    await renovar('staff', outroDispositivo.par).expect(401);
    await http()
      .post('/api/auth/staff/login')
      .set('Host', host())
      .send({ email: 'u4@a.com', senha: 'nova-senha-456' })
      .expect(200);
  });

  it('logout revoga só a própria família', async () => {
    const notebook = await loginStaff('u5@a.com');
    const celular = await loginStaff('u5@a.com');

    await http()
      .post('/api/auth/staff/logout')
      .set('Host', host())
      .set(CABECALHO_CSRF, '1')
      .set('Cookie', notebook.par)
      .expect(204);

    await renovar('staff', notebook.par).expect(401);
    await renovar('staff', celular.par).expect(200);
  });
});
