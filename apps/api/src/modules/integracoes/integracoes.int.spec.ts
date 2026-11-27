import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MODULOS_DE_SEED } from '../../seed/modulos';
import { ACADEMIA_RITMO } from '../../seed/plataforma';
import { executarSeed } from '../../seed/runner';
import { AlunosModule } from '../alunos/alunos.module';
import { RepositorioDeAlunos } from '../alunos/application/portas';
import { AcessoModule } from '../acesso/acesso.module';
import { AvisosModule } from '../avisos/avisos.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { EnvioDeEmail } from '../autenticacao/application/portas';
import { EnvioDeEmailFake } from '../autenticacao/infra/email/envio-de-email.fake';
import { FuncionariosModule } from '../funcionarios/funcionarios.module';
import { TreinosModule } from '../treinos/treinos.module';
import { RepositorioDeTenants } from '../platform/application/portas';
import { Consentimentos } from '../platform/application/protecao-de-dados';
import type { Tenant } from '../platform/domain/tenant';
import { ExecutorDeTenant } from '../platform/infra/contexto/executor-de-tenant';
import { ProtecaoDeDadosModule } from '../platform/protecao-de-dados.module';
import { usarBancoDeTeste } from '../platform/testing/banco-de-teste';
import { criarModuloDeEventos } from '../platform/testing/eventos-de-teste';
import { criarTenant } from '../platform/testing/fabricas';
import { usarRedisDeTeste } from '../platform/testing/redis-de-teste';
import { Armazenamento } from './application/armazenamento';
import { ConexoesMeta } from './application/conexoes-meta';
import { GeradorIA } from './application/gerador-ia';
import { Mensageria } from './application/mensageria';
import { ResolvedorDeVariaveis } from './application/resolvedor';
import { CODIGO_DE_VERIFICACAO_PENDENTE } from './infra/meta.fake';
import { WebhookDoWhatsapp } from './infra/adapters';
import { ProvedorDeIAFake } from './infra/ia.fake';
import { ObjetosDeArmazenamentoFake } from './infra/objetos.fake';
import { TransporteDeWhatsappFake } from './infra/whatsapp.fake';
import { IntegracoesModule } from './integracoes.module';

// Os oito casos do T13d, com os adapters fake e o seed de 19/11/2026.
describe('Integrações de plataforma (Meta, Mensageria, IA e arquivos)', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplicationContext;
  let tenantA: Tenant;
  let tenantB: Tenant;
  const executor = { usuarioId: randomUUID() };
  const TELEFONE = '11970001234';
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

  const noTenant = <T>(tenant: Tenant, corpo: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, corpo);
  const emA = <T>(corpo: () => Promise<T>): Promise<T> => noTenant(tenantA, corpo);
  const whatsapp = () => app.get(TransporteDeWhatsappFake);

  async function conectarWhatsapp(tenant: Tenant, codigo = 'codigo-ok'): Promise<void> {
    await noTenant(tenant, async () => {
      const conexoes = app.get(ConexoesMeta);
      const { urlDoFluxo } = await conexoes.iniciar('whatsapp', 'http://localhost/configuracoes');
      const state = new URL(urlDoFluxo).searchParams.get('state') ?? '';
      await conexoes.concluirPeloRetorno('whatsapp', codigo, state, executor);
    });
  }

  async function aluno(cpf: string, contato: { telefone: string | null; email: string | null }) {
    return emA(async () => {
      const repositorio = app.get(RepositorioDeAlunos);
      const id = (await repositorio.idPorCpf(cpf)) ?? '';
      const { id: _id, ...dados } = (await repositorio.porId(id, 'teste')) as never as Record<
        string,
        unknown
      > & { id: string };
      await repositorio.atualizar(id, { ...(dados as object), ...contato } as never);
      return id;
    });
  }

  beforeAll(async () => {
    app = await criarModuloDeEventos(banco, redis, {}, [
      ProtecaoDeDadosModule,
      IntegracoesModule,
      AlunosModule,
      FuncionariosModule,
      TreinosModule,
      AvisosModule,
      AcessoModule,
      FiscalModule,
    ]);
    await executarSeed(app, MODULOS_DE_SEED);
    const tenants = app.get(RepositorioDeTenants);
    tenantA = (await tenants.porSlug(ACADEMIA_RITMO.slug)) as Tenant;
    const criado = await criarTenant(await banco.conectarComoApp());
    tenantB = (await tenants.porSlug(criado.slug)) as Tenant;
  });

  it('marketing sem consentimento é recusado com motivo; transacional ao mesmo aluno é enviado', async () => {
    const rafael = await aluno('52998224725', { telefone: TELEFONE, email: null });
    await conectarWhatsapp(tenantA);
    await emA(() =>
      app.get(Consentimentos).registrar({
        alunoId: rafael,
        finalidade: 'marketing',
        decisao: 'revogacao',
        origem: 'teste',
      }),
    );

    const marketing = await emA(() =>
      app
        .get(Mensageria)
        .enviar({ alunoId: rafael, finalidade: 'marketing', modelo: 'Oi, {nome}!' }),
    );
    const transacional = await emA(() =>
      app
        .get(Mensageria)
        .enviar({ alunoId: rafael, finalidade: 'transacional', modelo: 'Oi, {nome}!' }),
    );

    expect(marketing).toMatchObject({ enviada: false, motivo: 'sem_consentimento' });
    expect(transacional).toMatchObject({ enviada: true, canal: 'whatsapp' });
    expect(whatsapp().doTenant(tenantA.id).at(-1)).toMatchObject({
      telefone: `55${TELEFONE}`,
      texto: 'Oi, Rafael!',
    });
  });

  it('resposta "SAIR" pelo webhook revoga o marketing; de A não aparece para B', async () => {
    const rafael = await aluno('52998224725', { telefone: TELEFONE, email: null });
    await emA(() =>
      app.get(Consentimentos).registrar({
        alunoId: rafael,
        finalidade: 'marketing',
        decisao: 'aceite',
        origem: 'teste',
      }),
    );
    const antes = await emA(() =>
      app.get(Mensageria).enviar({ alunoId: rafael, finalidade: 'marketing', modelo: 'Promo!' }),
    );
    const webhook = app.get(WebhookDoWhatsapp);
    const corpo = { tipo: 'resposta', de: `55${TELEFONE}`, texto: ' Sair. ' };

    expect(webhook.assinaturaValida(corpo, { 'x-hub-signature-256': webhook.assinar(corpo) })).toBe(
      true,
    );
    expect(webhook.assinaturaValida(corpo, { 'x-hub-signature-256': 'sha256=forjada' })).toBe(
      false,
    );
    await noTenant(tenantB, () => webhook.processar(corpo));
    const aindaAceito = await emA(() => app.get(Consentimentos).elegivel(rafael, 'marketing'));
    await emA(() => webhook.processar(corpo));
    const depois = await emA(() =>
      app.get(Mensageria).enviar({ alunoId: rafael, finalidade: 'marketing', modelo: 'Promo!' }),
    );
    const respostasEmB = await noTenant(tenantB, () => app.get(Mensageria).doAluno(rafael));

    expect(antes.enviada).toBe(true);
    expect(aindaAceito).toBe(true);
    expect(depois).toMatchObject({ enviada: false, motivo: 'sem_consentimento' });
    expect(respostasEmB).toEqual([]);
  });

  it('o status do provedor atualiza a mensagem enviada', async () => {
    const rafael = await aluno('52998224725', { telefone: TELEFONE, email: null });
    await emA(() =>
      app.get(Mensageria).enviar({ alunoId: rafael, finalidade: 'transacional', modelo: 'Oi' }),
    );
    const idExterno = whatsapp().doTenant(tenantA.id).at(-1)?.idExterno;
    const webhook = app.get(WebhookDoWhatsapp);

    await emA(() => webhook.processar({ tipo: 'status', idExterno, status: 'read' }));
    const mensagens = await emA(() => app.get(Mensageria).doAluno(rafael));

    expect(mensagens.find((m) => m.idExterno === idExterno)?.estado).toBe('lida');
  });

  it('o WhatsApp em "Verificação pendente" vira "Conectado" ao concluir; sem Marketing, ainda envia', async () => {
    const academia = (await criarTenant(await banco.conectarComoApp())).slug;
    const tenant = (await app.get(RepositorioDeTenants).porSlug(academia)) as Tenant;

    await conectarWhatsapp(tenant, CODIGO_DE_VERIFICACAO_PENDENTE);
    const pendente = await noTenant(tenant, () => app.get(ConexoesMeta).estado('whatsapp'));
    const concluida = await noTenant(tenant, () =>
      app.get(ConexoesMeta).concluir('whatsapp', executor),
    );
    const vizinha = await emA(() => app.get(ConexoesMeta).estado('instagram'));

    expect(pendente.estado).toBe('verificacao_pendente');
    expect(concluida.estado).toBe('conectado');
    expect(vizinha.estado).toBe('desconectado');
  });

  it('sem WhatsApp conectado, a mensagem vai por e-mail com a finalidade declarada', async () => {
    const camila = await aluno('11144477735', { telefone: null, email: 'camila@example.com' });

    const resultado = await emA(() =>
      app
        .get(Mensageria)
        .enviar({ alunoId: camila, finalidade: 'transacional', modelo: 'Oi, {nome}!' }),
    );

    expect(resultado).toMatchObject({ enviada: true, canal: 'email' });
    expect(
      (app.get(EnvioDeEmail) as EnvioDeEmailFake).ultimaPara('camila@example.com'),
    ).toMatchObject({ texto: 'Oi, Camila!', finalidade: 'transacional' });
  });

  it('o payload da IA não leva nome, CPF, telefone nem e-mail', async () => {
    await emA(() =>
      app.get(GeradorIA).gerar({
        finalidade: 'treinos.sugerir-ficha',
        instrucao: 'Monte a ficha de rafael@example.com (CPF 529.982.247-25)',
        dados: {
          nome: 'Rafael Souza',
          objetivo: 'hipertrofia',
          contato: { telefone: '(11) 98888-7777', email: 'rafael@example.com' },
          observacao: 'Ligar para 11988887777 ou 529.982.247-25',
        },
        formato: { titulo: 'texto', exercicios: 'lista' },
      }),
    );

    const enviado = JSON.stringify(app.get(ProvedorDeIAFake).pedidos.at(-1));
    expect(enviado).toContain('hipertrofia');
    expect(enviado).not.toMatch(/Rafael|529\.?982|rafael@|98888|988887777/);
  });

  it('arquivos: prefixo por tenant, URL assinada só do objeto, .exe recusado', async () => {
    const armazenamento = app.get(Armazenamento);
    const enviado = await emA(() =>
      armazenamento.enviar({
        pasta: 'treinos',
        nome: 'foto.png',
        tipo: 'image/png',
        conteudo: PNG,
      }),
    );
    const { url } = await emA(() => armazenamento.urlAssinada(enviado.chave, 60));
    const consulta = new URL(url).searchParams;
    const objetos = app.get(ObjetosDeArmazenamentoFake);
    const agora = new Date();
    const chave = consulta.get('chave') ?? '';
    const expira = consulta.get('expira') ?? '';
    const assinatura = consulta.get('assinatura') ?? '';

    expect(enviado.chave.startsWith(`tenant/${tenantA.id}/treinos/`)).toBe(true);
    expect(objetos.abrir(chave, expira, assinatura, agora)?.tipo).toBe('image/png');
    expect(
      objetos.abrir(chave.replace(tenantA.id, tenantB.id), expira, assinatura, agora),
    ).toBeNull();
    expect(objetos.abrir(chave, String(agora.getTime() - 1), assinatura, agora)).toBeNull();
    await expect(noTenant(tenantB, () => armazenamento.urlAssinada(enviado.chave))).rejects.toThrow(
      'não pertence',
    );
    await expect(
      emA(() =>
        armazenamento.enviar({
          pasta: 'treinos',
          nome: 'virus.exe',
          tipo: 'application/x-msdownload',
          conteudo: Buffer.from('MZ'),
        }),
      ),
    ).rejects.toThrow('não permitido');
    await expect(
      emA(() =>
        armazenamento.enviar({
          pasta: 'treinos',
          nome: 'virus.png',
          tipo: 'image/png',
          conteudo: Buffer.from('MZ....'),
        }),
      ),
    ).rejects.toThrow('conteúdo');
  });

  it('o resolvedor troca as variáveis pelos dados do aluno do contexto', async () => {
    const rafael = await aluno('52998224725', { telefone: TELEFONE, email: null });

    const texto = await emA(() =>
      app
        .get(ResolvedorDeVariaveis)
        .resolver('Olá, {nome}! {link}', 'cobranca', rafael, { link: 'pay.ritmo/abc123' }),
    );
    const plano = await emA(() =>
      app
        .get(ResolvedorDeVariaveis)
        .resolver('Plano {plano}, vence {vencimento}', 'marketing', rafael),
    );

    expect(texto).toBe('Olá, Rafael! pay.ritmo/abc123');
    expect(plano).toMatch(/^Plano .+, vence \d{2}\/\d{2}\/\d{4}$/);
  });
});
