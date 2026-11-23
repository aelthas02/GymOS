import { Controller, Delete, type INestApplication, Param } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import request from 'supertest';
import { criarAppDeTeste } from '../../../platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../../../platform/testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../../platform/testing/fabricas';
import { EnvioDeEmail } from '../../application/portas';
import { EnvioDeEmailFake } from '../../infra/email/envio-de-email.fake';
import { criarCredencialDeAluno, criarTiposPadrao, criarUsuario } from '../../testing/fabricas';
import { cookieDaResposta, CABECALHO_CSRF, tokenDeAcesso } from '../../testing/sessao';
import { RequirePermission } from './decoradores';

@Controller('teste-iso')
class RotaProtegidaController {
  @Delete('alunos/:id')
  @RequirePermission('alunos:excluir')
  excluir(@Param('id') id: string): { excluido: string } {
    return { excluido: id };
  }
}

const SENHA = 'senha-forte-123';

describe('isolamento entre tenants e públicos (T12)', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let a: TenantCriado;
  let b: TenantCriado;
  let email: EnvioDeEmailFake;

  const hostDe = (t: TenantCriado) => `${t.slug}.localhost:3000`;
  const http = () => request(app.getHttpServer());
  const tokenDoLink = (para: string): string => {
    const link = /https?:\/\/\S+/.exec(email.ultimaPara(para)?.texto ?? '')?.[0] ?? '';
    return new URL(link).searchParams.get('token') ?? '';
  };

  beforeAll(async () => {
    app = await criarAppDeTeste(banco, {}, { controllers: [RotaProtegidaController] });
    email = app.get(EnvioDeEmail) as EnvioDeEmailFake;
    conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    b = await criarTenant(conexao);
    for (const t of [a, b]) {
      await criarTiposPadrao(conexao, t.id);
    }
    await criarUsuario(conexao, a.id, { chave: 'administrador', email: 'adm@a.com', senha: SENHA });
    await criarUsuario(conexao, a.id, { chave: 'gerente', email: 'carla@a.com', senha: SENHA });
  });

  it('refresh do tenant A enviado no Host de B é recusado', async () => {
    const login = await http()
      .post('/api/auth/staff/login')
      .set('Host', hostDe(a))
      .send({ email: 'carla@a.com', senha: SENHA })
      .expect(200);
    const cookie = cookieDaResposta(login);

    await http()
      .post('/api/auth/staff/refresh')
      .set('Host', hostDe(b))
      .set(CABECALHO_CSRF, '1')
      .set('Cookie', cookie.par)
      .expect(401);
  });

  it('token de convite de A não funciona em B', async () => {
    const tokenAdm = tokenDeAcesso(app, {
      publico: 'staff',
      sujeitoId: await usuarioId('adm@a.com'),
      tenantId: a.id,
    });
    const tipos = await criarTiposPadrao(conexao, a.id);
    await http()
      .post('/api/equipe/convites')
      .set('Host', hostDe(a))
      .auth(tokenAdm, { type: 'bearer' })
      .send({ email: 'novo@a.com', nome: 'Novo', tipoDeAcessoId: tipos.professor })
      .expect(201);
    const token = tokenDoLink('novo@a.com');

    await http()
      .post('/api/auth/staff/convites/aceitar')
      .set('Host', hostDe(b))
      .send({ token, nome: 'Novo', senha: SENHA })
      .expect((r) => expect([404, 410]).toContain(r.status));
    await http()
      .post('/api/auth/staff/login')
      .set('Host', hostDe(b))
      .send({ email: 'novo@a.com', senha: SENHA })
      .expect(401);
    // Em A o mesmo token continua valendo: a recusa em B não o consumiu.
    await http()
      .post('/api/auth/staff/convites/aceitar')
      .set('Host', hostDe(a))
      .send({ token, nome: 'Novo', senha: SENHA })
      .expect(200);
  });

  it('token de redefinição de A não funciona em B', async () => {
    await http()
      .post('/api/auth/staff/esqueci-senha')
      .set('Host', hostDe(a))
      .send({ email: 'carla@a.com' })
      .expect(204);
    const token = tokenDoLink('carla@a.com');

    await http()
      .post('/api/auth/staff/redefinir-senha')
      .set('Host', hostDe(b))
      .send({ token, senha: 'outra-senha-456' })
      .expect(410);
    await http()
      .post('/api/auth/staff/login')
      .set('Host', hostDe(a))
      .send({ email: 'carla@a.com', senha: SENHA })
      .expect(200);
    await http()
      .post('/api/auth/staff/redefinir-senha')
      .set('Host', hostDe(a))
      .send({ token, senha: 'outra-senha-456' })
      .expect(204);
  });

  it('GET /api/me com token de aluno de A em B responde 401', async () => {
    const alunoId = randomUUID();
    await criarCredencialDeAluno(conexao, a.id, { alunoId, email: 'ana@a.com', senha: SENHA });
    const token = tokenDeAcesso(app, { publico: 'aluno', sujeitoId: alunoId, tenantId: a.id });

    await http().get('/api/me').set('Host', hostDe(b)).auth(token, { type: 'bearer' }).expect(401);
  });

  it('token de aluno não passa em rota @RequirePermission', async () => {
    const alunoId = randomUUID();
    await criarCredencialDeAluno(conexao, a.id, { alunoId, email: 'bia@a.com', senha: SENHA });
    const token = tokenDeAcesso(app, { publico: 'aluno', sujeitoId: alunoId, tenantId: a.id });

    await http()
      .delete(`/api/teste-iso/alunos/${randomUUID()}`)
      .set('Host', hostDe(a))
      .auth(token, { type: 'bearer' })
      .expect((r) => expect([401, 403]).toContain(r.status));
  });

  async function usuarioId(emailDoUsuario: string): Promise<string> {
    const resposta = await http()
      .post('/api/auth/staff/login')
      .set('Host', hostDe(a))
      .send({ email: emailDoUsuario, senha: SENHA })
      .expect(200);
    const [, corpo = ''] = (resposta.body as { accessToken: string }).accessToken.split('.');
    return (
      (
        JSON.parse(Buffer.from(corpo, 'base64url').toString()) as {
          sub?: string;
          sujeitoId?: string;
        }
      ).sub ?? ''
    );
  }
});
