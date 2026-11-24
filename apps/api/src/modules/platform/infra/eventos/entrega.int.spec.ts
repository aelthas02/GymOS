import type { INestApplicationContext } from '@nestjs/common';
import type { EventoDeDominio, NovoEvento, TipoDeEvento } from '@gymos/shared-events';
import { type Job, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { type NomeDaFila, PublicadorDeEventos } from '../../application/eventos';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import {
  contarEfeitos,
  criarModuloDeEventos,
  pagamentoConfirmado,
} from '../../testing/eventos-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';
import { aguardar, promessaControlada, usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { FilasBullMQ } from '../filas/filas.bullmq';
import { ProcessadorDeFilas } from '../filas/processador-de-filas';
import { DespachanteDoOutbox } from './despachante-do-outbox';
import { idDoJobDeEvento } from './entrega-de-eventos';
import { RegistroDeConsumidores } from './registro-de-consumidores';

const nuncaTermina = () => new Promise<never>(() => undefined);

describe('entrega dos eventos aos consumidores', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;
  let app: Client;
  let tenant: TenantCriado;
  let filas: FilasBullMQ;
  let processador: ProcessadorDeFilas;
  const workers: Worker[] = [];

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis, { tentativas: 5, atrasoInicialMs: 10 });
    app = await banco.conectarComoApp();
    tenant = await criarTenant(app);
    filas = modulo.get(FilasBullMQ);
    processador = modulo.get(ProcessadorDeFilas);
  });

  afterEach(async () => {
    await Promise.all(workers.splice(0).map((worker) => worker.close(true)));
  });

  /** Consumidor cujo efeito é criar uma unidade `efeito:<evento>` na transação da entrega. */
  function registrarConsumidor<T extends TipoDeEvento>(
    nome: string,
    evento: T,
    fila: NomeDaFila,
    antesDoEfeito: () => void = () => undefined,
  ): string[] {
    const tratados: string[] = [];
    const contexto = modulo.get(ContextoDoTenant);
    modulo.get(RegistroDeConsumidores).registrar({
      nome,
      evento,
      fila,
      tratar: async (recebido: EventoDeDominio<T>) => {
        tratados.push(recebido.id);
        antesDoEfeito();
        await contexto.cliente().unidade.create({
          data: { tenantId: recebido.tenantId, nome: `efeito:${recebido.id}` },
        });
      },
    });
    return tratados;
  }

  async function publicarEDespachar<T extends TipoDeEvento>(
    novo: NovoEvento<T>,
  ): Promise<EventoDeDominio<T>> {
    const evento = await modulo
      .get(ExecutorDeTenant)
      .runAsTenant(tenant.id, () => modulo.get(PublicadorDeEventos).publicar(novo));
    await modulo.get(DespachanteDoOutbox).despacharLote();
    return evento;
  }

  /** Worker que "cai": recebe o job, faz o que `antesDeCair` mandar e nunca confirma. */
  function workerQueCai(fila: NomeDaFila, antesDeCair: (job: Job) => Promise<void>): Worker {
    const worker = new Worker(
      fila,
      async (job) => {
        await antesDeCair(job);
        return nuncaTermina();
      },
      // Mesmo intervalo de verificação dos travados que o worker de verdade: o BullMQ só verifica
      // de novo depois do intervalo de quem verificou por último.
      { ...filas.opcoesDeConexao(), lockDuration: 1_000, stalledInterval: 200 },
    );
    workers.push(worker);
    return worker;
  }

  function workerDeVerdade(fila: NomeDaFila): Worker {
    const worker = processador.iniciarWorker(fila, { lockDuration: 1_000, stalledInterval: 200 });
    workers.push(worker);
    return worker;
  }

  async function aguardarEstado(fila: NomeDaFila, jobId: string, estado: string): Promise<Job> {
    try {
      await aguardar(async () => (await filas.fila(fila).getJobState(jobId)) === estado, {
        descricao: `o job ${jobId} ficar ${estado}`,
      });
    } catch (error) {
      const atual = await filas.fila(fila).getJob(jobId);
      const situacao = `${await atual?.getState()} (${atual?.failedReason ?? 'sem motivo'})`;
      throw new Error(`${(error as Error).message} Está ${situacao}.`, { cause: error });
    }
    const job = await filas.fila(fila).getJob(jobId);
    if (!job) {
      throw new Error(`job ${jobId} sumiu`);
    }
    return job;
  }

  it('worker cai depois do efeito e antes do ack: na reentrega, o efeito não acontece de novo', async () => {
    const tratados = registrarConsumidor('teste.cai-depois', 'PagamentoConfirmado', 'eventos');
    const evento = await publicarEDespachar(pagamentoConfirmado());
    const jobId = idDoJobDeEvento('teste.cai-depois', evento.id);

    const efeitoFeito = promessaControlada();
    const caido = workerQueCai('eventos', async (job) => {
      await processador.processar('eventos', job);
      efeitoFeito.resolve();
    });
    await efeitoFeito.promise;
    await caido.close(true);
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(1);

    workerDeVerdade('eventos');
    const job = await aguardarEstado('eventos', jobId, 'completed');

    expect(job.attemptsStarted).toBeGreaterThanOrEqual(2);
    expect(tratados).toEqual([evento.id]);
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(1);
  });

  it('worker cai antes do efeito: na reentrega, o efeito acontece uma vez', async () => {
    const tratados = registrarConsumidor('teste.cai-antes', 'CobrancaCriada', 'notas');
    const evento = await publicarEDespachar({
      tipo: 'CobrancaCriada',
      payload: {
        cobrancaId: randomUUID(),
        alunoId: randomUUID(),
        contratoId: null,
        parcelaId: null,
        forma: 'pix',
        valorEmCentavos: 14_990,
        vencimento: '2026-12-05',
      },
    });
    const jobId = idDoJobDeEvento('teste.cai-antes', evento.id);

    const recebido = promessaControlada();
    const caido = workerQueCai('notas', () => {
      recebido.resolve();
      return Promise.resolve();
    });
    await recebido.promise;
    await caido.close(true);
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(0);

    workerDeVerdade('notas');
    const job = await aguardarEstado('notas', jobId, 'completed');

    expect(job.attemptsStarted).toBeGreaterThanOrEqual(2);
    expect(tratados).toEqual([evento.id]);
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(1);
  });

  it('consumidor com erro 5 vezes vai para a DLQ com o motivo e pode ser reprocessado', async () => {
    let indisponivel = true;
    const tratados = registrarConsumidor('teste.dlq', 'ContratoCriado', 'cobranca', () => {
      if (indisponivel) {
        throw new Error('Emissor indisponível');
      }
    });
    const evento = await publicarEDespachar({
      tipo: 'ContratoCriado',
      payload: {
        contratoId: randomUUID(),
        alunoId: randomUUID(),
        planoId: randomUUID(),
        inicio: '2026-11-23',
        valorEmCentavos: 14_990,
        parcelas: 1,
      },
    });
    const jobId = idDoJobDeEvento('teste.dlq', evento.id);

    workerDeVerdade('cobranca');
    await aguardarEstado('cobranca', jobId, 'failed');
    const [falha] = await filas.falhas();

    expect(tratados).toHaveLength(5);
    expect(falha?.data).toMatchObject({
      tenantId: tenant.id,
      filaDeOrigem: 'cobranca',
      jobId,
      motivo: 'Emissor indisponível',
      tentativas: 5,
    });
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(0);

    indisponivel = false;
    await filas.reprocessarFalha(falha?.id ?? '');
    await aguardarEstado('cobranca', jobId, 'completed');

    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(1);
    expect(await filas.falhas()).toEqual([]);
  });
});
