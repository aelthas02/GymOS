import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { ACADEMIA_RITMO } from '../../seed/plataforma';
import { MODULOS_DE_SEED } from '../../seed/modulos';
import { executarSeed } from '../../seed/runner';
import { AlunosModule } from '../alunos/alunos.module';
import { Contratos } from '../alunos/application/contratos';
import { RepositorioDeAlunos } from '../alunos/application/portas';
import { Acessos } from '../acesso/application/acessos';
import { AcessoModule } from '../acesso/acesso.module';
import { AvisosModule } from '../avisos/avisos.module';
import { FuncionariosModule } from '../funcionarios/funcionarios.module';
import { Consentimentos } from '../platform/application/protecao-de-dados';
import { RepositorioDeTenants } from '../platform/application/portas';
import { Relogio } from '../platform/domain/relogio';
import { ContextoDoTenant } from '../platform/infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../platform/infra/contexto/executor-de-tenant';
import { ProtecaoDeDadosModule } from '../platform/protecao-de-dados.module';
import { usarBancoDeTeste } from '../platform/testing/banco-de-teste';
import { criarModuloDeEventos, tenantFicticio } from '../platform/testing/eventos-de-teste';
import { aguardar, usarRedisDeTeste } from '../platform/testing/redis-de-teste';
import { AoVivo, type MensagemAoVivo } from './application/ao-vivo';
import { CadastrosBiometricos } from './application/biometria';
import { CacheDeAutorizacao } from './application/cache-de-acesso';
import { ComandosDoAgente } from './application/comandos';
import { Dispositivos } from './application/dispositivos';
import {
  CodigoDePareamentoInvalidoError,
  ConsentimentoDeBiometriaNecessarioError,
  CredencialDoAgenteInvalidaError,
} from './application/erros';
import { Pareamento } from './application/pareamento';
import { DispositivosModule } from './dispositivos.module';

// Fluxo do T23b com o seed: pareamento (30 min, uso único, revogação), queda e volta de dispositivo,
// cache de autorização com versão, tempo real entre duas réplicas e cadastro biométrico com consentimento.
describe('Dispositivos, pareamento e tempo real', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  const modulos = [
    ProtecaoDeDadosModule,
    AlunosModule,
    FuncionariosModule,
    AvisosModule,
    AcessoModule,
    DispositivosModule,
  ];
  let replica1: INestApplicationContext; // registra e processa os eventos (workers ligados)
  let replica2: INestApplicationContext; // só recebe: o cliente SSE está conectado nela
  let tenantId: string;
  const quinta = (hora: string): Date => new Date(`2026-11-19T${hora}-03:00`);
  let agora = quinta('07:00:00');
  const executor = { usuarioId: randomUUID() };

  const noTenant = <T>(corpo: () => Promise<T>, app = replica1): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenantId, corpo);
  const alunoId = (cpf: string): Promise<string | null> =>
    noTenant(() => replica1.get(RepositorioDeAlunos).idPorCpf(cpf));

  beforeAll(async () => {
    replica1 = await criarModuloDeEventos(banco, redis, { processar: true }, modulos);
    replica2 = await criarModuloDeEventos(banco, redis, {}, modulos);
    vi.spyOn(replica1.get(Relogio), 'agora').mockImplementation(() => new Date(agora));
    vi.spyOn(replica2.get(Relogio), 'agora').mockImplementation(() => new Date(agora));
    await executarSeed(replica1, MODULOS_DE_SEED);
    const tenant = await replica1.get(RepositorioDeTenants).porSlug(ACADEMIA_RITMO.slug);
    tenantId = tenant?.id ?? '';
  });

  it('código aceito com 30 min, recusado com 31 min e de uso único', async () => {
    agora = quinta('08:00:00');
    const primeiro = await noTenant(() => replica1.get(Pareamento).gerarCodigo(executor));
    agora = quinta('08:30:00');
    const troca = await noTenant(() =>
      replica1.get(Pareamento).trocarCodigo(primeiro.codigoFormatado.toLowerCase(), {}),
    );
    await expect(
      noTenant(() => replica1.get(Pareamento).trocarCodigo(primeiro.codigo, {})),
    ).rejects.toBeInstanceOf(CodigoDePareamentoInvalidoError);

    agora = quinta('09:00:00');
    const segundo = await noTenant(() => replica1.get(Pareamento).gerarCodigo(executor));
    agora = quinta('09:30:01');
    await expect(
      noTenant(() => replica1.get(Pareamento).trocarCodigo(segundo.codigo, {})),
    ).rejects.toBeInstanceOf(CodigoDePareamentoInvalidoError);

    expect(primeiro.codigo).toHaveLength(6);
    expect(troca.credencial).toMatch(/^ga1\./);
  });

  it('credencial revogada ou rotacionada deixa de valer', async () => {
    agora = quinta('10:00:00');
    const codigo = await noTenant(() => replica1.get(Pareamento).gerarCodigo(executor));
    const { agenteId, credencial } = await noTenant(() =>
      replica1.get(Pareamento).trocarCodigo(codigo.codigo, { nome: 'PC da recepção' }),
    );

    const agente = await noTenant(() => replica1.get(Pareamento).autenticar(credencial));
    const nova = await noTenant(() => replica1.get(Pareamento).rotacionar(agente));
    await expect(
      noTenant(() => replica1.get(Pareamento).autenticar(credencial)),
    ).rejects.toBeInstanceOf(CredencialDoAgenteInvalidaError);
    await noTenant(() => replica1.get(Pareamento).autenticar(nova.credencial));
    await noTenant(() => replica1.get(Pareamento).revogar(executor, agenteId));
    await expect(
      noTenant(() => replica1.get(Pareamento).autenticar(nova.credencial)),
    ).rejects.toBeInstanceOf(CredencialDoAgenteInvalidaError);
  });

  it('90 s sem batimento = offline e alerta; a volta fecha o alerta com a duração; testar conexão', async () => {
    agora = quinta('07:00:00');
    const codigo = await noTenant(() => replica1.get(Pareamento).gerarCodigo(executor));
    const { credencial } = await noTenant(() =>
      replica1.get(Pareamento).trocarCodigo(codigo.codigo, {}),
    );
    const agente = await noTenant(() => replica1.get(Pareamento).autenticar(credencial));
    const catraca = await noTenant(() =>
      replica1.get(Dispositivos).cadastrar(executor, {
        nome: 'Catraca 2',
        tipo: 'catraca',
        local: 'Entrada',
        metodos: ['facial', 'biometria'],
        unidadeId: null,
        agenteId: agente.id,
      }),
    );

    agora = quinta('07:12:00');
    await noTenant(() => replica1.get(Dispositivos).registrarBatimento(agente, {}));
    agora = quinta('07:13:00');
    const aindaOnline = await noTenant(() => replica1.get(Dispositivos).verificarQuedas());
    agora = quinta('07:13:31');
    const caiu = await noTenant(() => replica1.get(Dispositivos).verificarQuedas());
    const aberto = await noTenant(() => replica1.get(Dispositivos).alertas());

    agora = quinta('07:16:00');
    await noTenant(() => replica1.get(Dispositivos).registrarBatimento(agente, {}));
    const fechado = await noTenant(() => replica1.get(Dispositivos).alertas());
    const lista = await noTenant(() => replica1.get(Dispositivos).listar());

    expect(aindaOnline).toBe(0);
    expect(caiu).toBe(1);
    expect(aberto[0]).toMatchObject({
      aberto: true,
      texto: 'Catraca 2 está sem resposta desde 07:12',
    });
    expect(fechado[0]).toMatchObject({
      aberto: false,
      duracaoEmSegundos: 240,
      texto: 'Catraca 2 ficou 4 minutos sem resposta às 07:12 e já voltou',
    });
    expect(lista.find((d) => d.id === catraca.id)?.statusOnline).toBe(true);

    const { comandoId } = await noTenant(() =>
      replica1.get(ComandosDoAgente).testarConexao({ dispositivoId: catraca.id }),
    );
    expect(
      await noTenant(() => replica1.get(ComandosDoAgente).resultadoDoTeste(comandoId)),
    ).toEqual({
      estado: 'aguardando',
    });
    const batimento = await noTenant(() =>
      replica1.get(Dispositivos).registrarBatimento(agente, {}),
    );
    expect(batimento.comandos).toMatchObject([{ id: comandoId, tipo: 'ping' }]);
    await noTenant(() => replica1.get(ComandosDoAgente).responder(agente, comandoId, { ok: true }));
    expect(
      await noTenant(() => replica1.get(ComandosDoAgente).resultadoDoTeste(comandoId)),
    ).toMatchObject({ estado: 'ok' });
  });

  it('SSE: o acesso registrado na réplica 1 chega ao cliente da réplica 2; outro tenant não recebe', async () => {
    const recebidas: MensagemAoVivo[] = [];
    const deOutroTenant: MensagemAoVivo[] = [];
    const cancelar = await noTenant(
      () => replica2.get(AoVivo).assinar((m) => recebidas.push(m)),
      replica2,
    );
    const cancelarOutro = await replica2
      .get(ContextoDoTenant)
      .executar({ tenant: tenantFicticio('outra') }, () =>
        replica2.get(AoVivo).assinar((m) => deOutroTenant.push(m)),
      );

    agora = quinta('11:00:00');
    const pedro = (await alunoId('12345678909')) ?? '';
    await noTenant(() =>
      replica1.get(Acessos).registrar({ alunoId: pedro, metodo: 'facial', direcao: 'entrada' }),
    );
    await aguardar(() => recebidas.some((m) => m.tipo === 'acesso'), {
      descricao: 'o acesso na outra réplica',
    });

    expect(recebidas.find((m) => m.tipo === 'acesso')).toMatchObject({
      tipo: 'acesso',
      alunoId: pedro,
      resultado: 'liberado',
    });
    expect(deOutroTenant).toEqual([]);
    await cancelar();
    await cancelarOutro();
  });

  it('mudança de contrato aumenta a versão do cache e o agente recebe o aluno como bloqueado', async () => {
    agora = quinta('12:00:00');
    const larissa = (await alunoId('45678901249')) ?? '';
    const carga = await noTenant(() => replica1.get(CacheDeAutorizacao).obter(undefined, 500));
    const antes = carga.alunos.find((a) => a.alunoId === larissa);

    await noTenant(() => replica1.get(Contratos).trancar(larissa, 30));
    await aguardar(
      async () =>
        (await noTenant(() => replica1.get(CacheDeAutorizacao).versaoAtual())) > carga.versao,
      { descricao: 'a versão nova do cache' },
    );
    const incremento = await noTenant(() =>
      replica1.get(CacheDeAutorizacao).obter(carga.versao, 500),
    );

    expect(antes?.situacao.resultado).not.toBe('negado');
    expect(incremento.alunos).toHaveLength(1);
    expect(incremento.alunos[0]).toMatchObject({
      alunoId: larissa,
      contrato: 'trancado',
      situacao: { resultado: 'negado', motivo: 'plano_trancado' },
    });
    expect(incremento.versao).toBeGreaterThan(carga.versao);
  });

  it('cadastro de face sem o consentimento biometria é recusado; com ele, o agente conclui', async () => {
    agora = quinta('13:00:00');
    const juliana = (await alunoId('39053344705')) ?? '';
    const codigo = await noTenant(() => replica1.get(Pareamento).gerarCodigo(executor));
    const { credencial } = await noTenant(() =>
      replica1.get(Pareamento).trocarCodigo(codigo.codigo, {}),
    );
    const agente = await noTenant(() => replica1.get(Pareamento).autenticar(credencial));
    const leitor = await noTenant(() =>
      replica1.get(Dispositivos).cadastrar(executor, {
        nome: 'Leitor facial',
        tipo: 'leitor',
        local: 'Recepção',
        metodos: ['facial'],
        unidadeId: null,
        agenteId: agente.id,
      }),
    );
    const pedido = { alunoId: juliana, tipo: 'facial' as const, dispositivoId: leitor.id };

    await expect(
      noTenant(() => replica1.get(CadastrosBiometricos).solicitar(executor, pedido)),
    ).rejects.toBeInstanceOf(ConsentimentoDeBiometriaNecessarioError);
    await noTenant(() =>
      replica1.get(Consentimentos).registrar({
        alunoId: juliana,
        finalidade: 'biometria',
        decisao: 'aceite',
        origem: 'painel',
      }),
    );
    const pendente = await noTenant(() =>
      replica1.get(CadastrosBiometricos).solicitar(executor, pedido),
    );
    const { comandos } = await noTenant(() =>
      replica1.get(Dispositivos).registrarBatimento(agente, {}),
    );
    await noTenant(() =>
      replica1
        .get(ComandosDoAgente)
        .responder(agente, comandos[0]?.id ?? '', { ok: true, referencia: 'face-123' }),
    );
    const [cadastrado] = await noTenant(() => replica1.get(CadastrosBiometricos).doAluno(juliana));

    expect(pendente.status).toBe('pendente');
    expect(comandos).toMatchObject([{ tipo: 'cadastrar_biometria' }]);
    expect(cadastrado).toMatchObject({ status: 'cadastrado', referencia: 'face-123' });
  });
});
