import type { INestApplicationContext } from '@nestjs/common';
import { EntrarComoEquipe } from '../autenticacao/application/entrada';
import {
  CifraDeSenha,
  EnvioDeEmail,
  RepositorioDeTiposDeAcesso,
  RepositorioDeUsuarios,
} from '../autenticacao/application/portas';
import { EnvioDeEmailFake } from '../autenticacao/infra/email/envio-de-email.fake';
import { TIPOS_PADRAO } from '../autenticacao/domain/tipos-de-acesso';
import { ProtecaoDeDadosModule } from '../platform/protecao-de-dados.module';
import { RepositorioDeTenants } from '../platform/application/portas';
import type { Tenant } from '../platform/domain/tenant';
import { ExecutorDeTenant } from '../platform/infra/contexto/executor-de-tenant';
import { usarBancoDeTeste } from '../platform/testing/banco-de-teste';
import { criarModuloDeEventos } from '../platform/testing/eventos-de-teste';
import { comTenant, criarTenant } from '../platform/testing/fabricas';
import { usarRedisDeTeste } from '../platform/testing/redis-de-teste';
import { FuncionariosModule } from './funcionarios.module';
import { ConflitoError } from './application/erros';
import { Funcionarios } from './application/funcionarios';
import { RegistroDeVinculos } from './application/portas';

describe('Funcionários (acesso, convite, vínculos e auditoria)', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplicationContext;
  let tenant: Tenant;
  const executor = { usuarioId: '00000000-0000-4000-8000-000000000001' };

  const noTenant = <T>(corpo: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, corpo);
  const email = () => app.get(EnvioDeEmail) as EnvioDeEmailFake;

  beforeAll(async () => {
    app = await criarModuloDeEventos(banco, redis, {}, [ProtecaoDeDadosModule, FuncionariosModule]);
    const criado = await criarTenant(await banco.conectarComoApp());
    const achado = await app.get(RepositorioDeTenants).porSlug(criado.slug);
    if (!achado) {
      throw new Error('tenant do teste não encontrado');
    }
    tenant = achado;
    await noTenant(() => app.get(RepositorioDeTiposDeAcesso).garantirPadrao(TIPOS_PADRAO));
  });

  const tipo = (chave: string) =>
    noTenant(async () => (await app.get(RepositorioDeTiposDeAcesso).porChave(chave))?.id ?? '');

  it('limpeza sem acesso não cria usuário nem exige e-mail', async () => {
    const funcionario = await noTenant(() =>
      app.get(Funcionarios).criar(tenant, executor, {
        nome: 'Dona Neide',
        cargo: 'limpeza',
        custoMensalCentavos: 10000,
      }),
    );

    expect(funcionario).toMatchObject({ tipoDeAcessoId: null, usuarioId: null, email: null });
    expect(email().enviados).toEqual([]);
  });

  it('tipo de acesso sem e-mail é recusado', async () => {
    const professor = await tipo('professor');

    await expect(
      noTenant(() =>
        app.get(Funcionarios).criar(tenant, executor, {
          nome: 'Diego',
          cargo: 'professor',
          tipoDeAcessoId: professor,
        }),
      ),
    ).rejects.toThrow('e-mail de login é obrigatório');
  });

  it('criar duas vezes com o mesmo e-mail devolve o mesmo funcionário e convida uma vez só', async () => {
    const entrada = {
      nome: 'Lia',
      cargo: 'professor',
      email: 'Lia@Ritmo.com',
      tipoDeAcessoId: await tipo('professor'),
    };

    const primeiro = await noTenant(() =>
      app.get(Funcionarios).criarSeNaoExistir(tenant, executor, entrada),
    );
    const segundo = await noTenant(() =>
      app.get(Funcionarios).criarSeNaoExistir(tenant, executor, entrada),
    );

    expect(primeiro.criado).toBe(true);
    expect(segundo).toEqual({ funcionario: primeiro.funcionario, criado: false });
    expect(email().enviados.filter((e) => e.para === 'lia@ritmo.com')).toHaveLength(1);
    expect(primeiro.funcionario.usuarioId).not.toBeNull();
  });

  it('voltar para "Sem acesso" desativa o usuário e o login passa a ser recusado', async () => {
    const entrada = {
      nome: 'Camila',
      cargo: 'professor',
      email: 'camila@ritmo.com',
      tipoDeAcessoId: await tipo('professor'),
    };
    const criado = await noTenant(() => app.get(Funcionarios).criar(tenant, executor, entrada));
    await noTenant(async () =>
      app
        .get(RepositorioDeUsuarios)
        .definirSenha(criado.usuarioId ?? '', await app.get(CifraDeSenha).cifrar('gymos1234')),
    );
    const tentativa = { tenantId: tenant.id, ip: '127.0.0.1' };
    const entrar = () =>
      noTenant(() =>
        app
          .get(EntrarComoEquipe)
          .executar(tentativa, { email: 'camila@ritmo.com', senha: 'gymos1234' }),
      );
    expect((await entrar()).tipo).toBe('ok');

    await noTenant(() =>
      app
        .get(Funcionarios)
        .editar(tenant, executor, criado.id, { ...entrada, tipoDeAcessoId: null }),
    );

    expect((await entrar()).tipo).toBe('invalido');
    const usuario = await noTenant(() =>
      app.get(RepositorioDeUsuarios).porId(criado.usuarioId ?? ''),
    );
    expect(usuario?.ativo).toBe(false);
  });

  it('excluir com vínculo é recusado, inativar é aceito', async () => {
    const funcionario = await noTenant(() =>
      app
        .get(Funcionarios)
        .criar(tenant, executor, { nome: 'Renata', cargo: 'nutricionista', email: null }),
    );
    app.get(RegistroDeVinculos).registrar({
      nome: 'aulas',
      descrever: async (id) => (id === funcionario.id ? 'é professor de uma aula' : null),
    });

    await expect(
      noTenant(() => app.get(Funcionarios).excluir(executor, funcionario.id)),
    ).rejects.toBeInstanceOf(ConflitoError);
    const inativo = await noTenant(() =>
      app.get(Funcionarios).inativar(tenant, executor, funcionario.id),
    );

    expect(inativo.ativo).toBe(false);
  });

  it('alterar o custo mensal registra auditoria sensível', async () => {
    const criado = await noTenant(() =>
      app.get(Funcionarios).criar(tenant, executor, {
        nome: 'Marcos',
        cargo: 'manutencao',
        custoMensalCentavos: 15000,
      }),
    );

    await noTenant(() =>
      app.get(Funcionarios).editar(tenant, executor, criado.id, {
        nome: 'Marcos',
        cargo: 'manutencao',
        custoMensalCentavos: 18000,
      }),
    );

    const rows = await comTenant(await banco.conectarComoApp(), tenant.id, async (conexao) => {
      const { rows: linhas } = await conexao.query<{ detalhe: string; sensivel: boolean }>(
        "SELECT detalhe, sensivel FROM atividade WHERE acao = 'alterou-custo-de-funcionario'",
      );
      return linhas;
    });
    expect(rows).toEqual([{ detalhe: 'Marcos: R$ 150,00 → R$ 180,00', sensivel: true }]);
  });
});
