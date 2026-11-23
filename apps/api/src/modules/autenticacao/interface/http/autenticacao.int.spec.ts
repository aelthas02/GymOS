import { Controller, Delete, Get, type INestApplication, Param } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import request from 'supertest';
import { criarAppDeTeste } from '../../../platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../../../platform/testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../../platform/testing/fabricas';
import { AoNegarPermissao, EnvioDeEmail, LocalizadorDeAlunoPorCpf } from '../../application/portas';
import { EnvioDeEmailFake } from '../../infra/email/envio-de-email.fake';
import { LocalizadorDeAlunoEmMemoria } from '../../infra/localizador-de-aluno';
import {
  criarCredencialDeAluno,
  criarTiposPadrao,
  criarUsuario,
  definirModulo,
} from '../../testing/fabricas';
import { cookieDaResposta, CABECALHO_CSRF } from '../../testing/sessao';
import { RequireModule, RequirePermission } from './decoradores';

@Controller('teste')
class RotasDeTesteController {
  @Delete('alunos/:id')
  @RequirePermission('alunos:excluir')
  excluirAluno(@Param('id') id: string): { excluido: string } {
    return { excluido: id };
  }

  @Get('loja')
  @RequireModule('loja')
  loja(): { ok: true } {
    return { ok: true };
  }
}

const SENHA = 'senha-forte-123';

describe('autenticação, RBAC e módulos (T12)', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let a: TenantCriado;
  let b: TenantCriado;
  let email: EnvioDeEmailFake;

  const hostDe = (tenant: TenantCriado) => `${tenant.slug}.localhost:3000`;
  const http = () => request(app.getHttpServer());

  const entrarNoPainel = (tenant: TenantCriado, login: string, senha = SENHA) =>
    http().post('/api/auth/staff/login').set('Host', hostDe(tenant)).send({ email: login, senha });

  const renovarNoPainel = (tenant: TenantCriado, cookie: string) =>
    http()
      .post('/api/auth/staff/refresh')
      .set('Host', hostDe(tenant))
      .set(CABECALHO_CSRF, '1')
      .set('Cookie', cookie);

  const tokenDe = async (tenant: TenantCriado, login: string): Promise<string> =>
    ((await entrarNoPainel(tenant, login).expect(200)).body as { accessToken: string }).accessToken;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco, {}, { controllers: [RotasDeTesteController] });
    email = app.get(EnvioDeEmail) as EnvioDeEmailFake;
    conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    b = await criarTenant(conexao);
    for (const tenant of [a, b]) {
      await criarTiposPadrao(conexao, tenant.id);
    }
    await criarUsuario(conexao, a.id, { chave: 'administrador', email: 'adm@a.com', senha: SENHA });
    await criarUsuario(conexao, a.id, { chave: 'recepcao', email: 'joao@a.com', senha: SENHA });
    await criarUsuario(conexao, a.id, { chave: 'gerente', email: 'carla@a.com', senha: SENHA });
  });

  it('1. refresh reutilizado revoga todos os tokens da família', async () => {
    const primeiro = cookieDaResposta(await entrarNoPainel(a, 'carla@a.com').expect(200));
    const segundo = cookieDaResposta(await renovarNoPainel(a, primeiro.par).expect(200));

    await renovarNoPainel(a, primeiro.par).expect(401);

    // O sucessor legítimo também morreu: a família inteira foi revogada.
    await renovarNoPainel(a, segundo.par).expect(401);
  });

  it('2. Recepção sem alunos:excluir recebe 403', async () => {
    const token = await tokenDe(a, 'joao@a.com');

    await http()
      .delete(`/api/teste/alunos/${randomUUID()}`)
      .set('Host', hostDe(a))
      .auth(token, { type: 'bearer' })
      .expect(403);

    const doAdministrador = await tokenDe(a, 'adm@a.com');
    await http()
      .delete(`/api/teste/alunos/${randomUUID()}`)
      .set('Host', hostDe(a))
      .auth(doAdministrador, { type: 'bearer' })
      .expect(200);
  });

  it("3. rota com @RequireModule('loja') em tenant sem Loja responde 404", async () => {
    await http().get('/api/teste/loja').set('Host', hostDe(b)).expect(404);

    await definirModulo(conexao, b.id, 'loja', true);
    await http().get('/api/teste/loja').set('Host', hostDe(b)).expect(200);
    await definirModulo(conexao, b.id, 'loja', false);
    await http().get('/api/teste/loja').set('Host', hostDe(b)).expect(404);
  });

  it('4. login do aluno aceita CPF com e sem pontuação e o e-mail', async () => {
    const alunoId = randomUUID();
    await criarCredencialDeAluno(conexao, a.id, {
      alunoId,
      email: 'paulo@exemplo.com',
      senha: SENHA,
    });
    (app.get(LocalizadorDeAlunoPorCpf) as LocalizadorDeAlunoEmMemoria).registrar(
      a.id,
      '12345678909',
      alunoId,
    );

    for (const identificador of ['123.456.789-09', '12345678909', 'Paulo@Exemplo.com']) {
      const resposta = await http()
        .post('/api/auth/aluno/login')
        .set('Host', hostDe(a))
        .send({ identificador, senha: SENHA })
        .expect(200);
      expect(resposta.body).toMatchObject({ accessToken: expect.any(String) });
    }
    await http()
      .post('/api/auth/aluno/login')
      .set('Host', hostDe(a))
      .send({ identificador: '123.456.789-09', senha: 'senha-errada-1' })
      .expect(401);
  });

  describe('5. convite', () => {
    const convidar = async (convidado: string): Promise<string> => {
      const token = await tokenDe(a, 'adm@a.com');
      const tipos = await criarTiposPadrao(conexao, a.id);
      await http()
        .post('/api/equipe/convites')
        .set('Host', hostDe(a))
        .auth(token, { type: 'bearer' })
        .send({ email: convidado, nome: 'Diego Martins', tipoDeAcessoId: tipos.professor })
        .expect(201);
      const mensagem = email.ultimaPara(convidado);
      const link = /https?:\/\/\S+/.exec(mensagem?.texto ?? '')?.[0] ?? '';
      return new URL(link).searchParams.get('token') ?? '';
    };
    const aceitar = (token: string, relogio?: string) => {
      const requisicao = http()
        .post('/api/auth/staff/convites/aceitar')
        .set('Host', hostDe(a))
        .send({ token, nome: 'Diego Martins', senha: SENHA });
      return relogio ? requisicao.set('x-relogio', relogio) : requisicao;
    };

    it('já usado é recusado', async () => {
      const token = await convidar('diego@a.com');

      await aceitar(token).expect(200);
      await aceitar(token).expect(410);
    });

    it('expirado é recusado', async () => {
      const token = await convidar('expirado@a.com');
      const daquiAOitoDias = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

      await aceitar(token, daquiAOitoDias).expect(410);
      await entrarNoPainel(a, 'expirado@a.com').expect(401);
    });
  });

  it('6. a 6ª tentativa errada em 15 min bloqueia temporariamente', async () => {
    await criarUsuario(conexao, a.id, { chave: 'professor', email: 'alvo@a.com', senha: SENHA });
    const inicio = Date.now();
    const em = (minutos: number) => new Date(inicio + minutos * 60_000).toISOString();
    const tentar = (senha: string, minuto: number) =>
      entrarNoPainel(a, 'alvo@a.com', senha).set('x-relogio', em(minuto));

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await tentar('senha-errada-1', tentativa).expect(401);
    }
    await tentar('senha-errada-1', 5).expect(429);
    // Bloqueado, nem a senha certa entra; passados 15 min da série, volta a entrar.
    await tentar(SENHA, 6).expect(429);
    await tentar(SENHA, 21).expect(200);
  });

  it('7. usuário de um tenant não autentica no subdomínio de outro', async () => {
    await entrarNoPainel(b, 'carla@a.com').expect(401);

    const tokenDeA = await tokenDe(a, 'carla@a.com');
    await http()
      .get('/api/me')
      .set('Host', hostDe(b))
      .auth(tokenDeA, { type: 'bearer' })
      .expect(401);
    await http()
      .get('/api/me')
      .set('Host', hostDe(a))
      .auth(tokenDeA, { type: 'bearer' })
      .expect(200);
  });

  it('8. cookies de refresh: sem Domain, Path próprio e sessões independentes no mesmo host', async () => {
    const alunoId = randomUUID();
    await criarCredencialDeAluno(conexao, a.id, {
      alunoId,
      email: 'ana@exemplo.com',
      senha: SENHA,
    });

    const painel = cookieDaResposta(await entrarNoPainel(a, 'carla@a.com').expect(200));
    const doApp = cookieDaResposta(
      await http()
        .post('/api/auth/aluno/login')
        .set('Host', hostDe(a))
        .send({ identificador: 'ana@exemplo.com', senha: SENHA })
        .expect(200),
    );

    expect(painel.nome).toBe('gymos_rt_staff');
    expect(doApp.nome).toBe('gymos_rt_aluno');
    for (const cookie of [painel, doApp]) {
      expect(cookie.atributos).not.toHaveProperty('domain');
      expect(cookie.atributos).toMatchObject({ httponly: true, secure: true, samesite: 'Lax' });
    }
    expect(painel.atributos['path']).toBe('/api/auth/staff');
    expect(doApp.atributos['path']).toBe('/api/auth/aluno');

    // O navegador manda os dois cookies onde os caminhos coincidirem; cada app só usa o seu.
    const ambos = `${painel.par}; ${doApp.par}`;
    await http()
      .post('/api/auth/staff/logout')
      .set('Host', hostDe(a))
      .set(CABECALHO_CSRF, '1')
      .set('Cookie', ambos)
      .expect(204);
    await renovarNoPainel(a, painel.par).expect(401);
    await http()
      .post('/api/auth/aluno/refresh')
      .set('Host', hostDe(a))
      .set(CABECALHO_CSRF, '1')
      .set('Cookie', ambos)
      .expect(200);
  });

  it('9. o 403 aciona o gancho aoNegarPermissao com usuário, permissão e rota', async () => {
    const gancho = vi.spyOn(app.get(AoNegarPermissao), 'registrar');
    const token = await tokenDe(a, 'joao@a.com');
    const me = await http()
      .get('/api/me')
      .set('Host', hostDe(a))
      .auth(token, { type: 'bearer' })
      .expect(200);

    await http()
      .delete(`/api/teste/alunos/${randomUUID()}`)
      .set('Host', hostDe(a))
      .auth(token, { type: 'bearer' })
      .expect(403);

    expect(gancho).toHaveBeenCalledWith({
      tenantId: a.id,
      usuarioId: (me.body as { id: string }).id,
      permissao: 'alunos:excluir',
      rota: 'DELETE /api/teste/alunos/:id',
    });
  });
});
