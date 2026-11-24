import { Inject, Injectable, type OnModuleDestroy, Optional } from '@nestjs/common';
import { type Job, type JobsOptions, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { QueueMetrics } from '../../../../observabilidade/metrics/metrics';
import {
  type DadosDoJob,
  Filas,
  JobSemTenantError,
  type NomeDaFila,
  type OpcoesDoJob,
} from '../../application/eventos';
import { CONFIGURACAO_DAS_FILAS, type ConfiguracaoDasFilas } from './configuracao-das-filas';
import { ConexaoRedis } from './conexao-redis';

/** Fila de falhas (DLQ): sem worker; guarda o job que esgotou as tentativas até o reprocessamento. */
export const FILA_DE_FALHAS = 'falhas';

export interface DadosDaFalha extends DadosDoJob {
  filaDeOrigem: NomeDaFila;
  jobId: string;
  nome: string;
  dados: DadosDoJob;
  motivo: string;
  tentativas: number;
}

export interface JobParaEnfileirar {
  nome: string;
  dados: DadosDoJob;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEITURA_DAS_METRICAS_MS = 2_000;

function temTenant(dados: unknown): dados is DadosDoJob {
  const tenantId = (dados as Partial<DadosDoJob> | null | undefined)?.tenantId;
  return typeof tenantId === 'string' && UUID.test(tenantId);
}

/** Uma Queue do BullMQ por fila, criada no primeiro uso e registrada nas métricas (/metrics). */
@Injectable()
export class FilasBullMQ extends Filas implements OnModuleDestroy {
  private readonly filas = new Map<string, Queue>();
  private readonly cancelarMetricas: Array<() => void> = [];

  constructor(
    private readonly conexao: ConexaoRedis,
    @Inject(CONFIGURACAO_DAS_FILAS) private readonly config: ConfiguracaoDasFilas,
    @Optional() private readonly metricas?: QueueMetrics,
  ) {
    super();
  }

  /** Conexão e prefixo para Workers e QueueEvents das mesmas filas. */
  opcoesDeConexao(): { connection: Redis; prefix: string } {
    return { connection: this.conexao.cliente(), prefix: `${this.conexao.prefixo}:bull` };
  }

  fila(nome: NomeDaFila | typeof FILA_DE_FALHAS): Queue {
    let fila = this.filas.get(nome);
    if (!fila) {
      fila = new Queue(nome, { ...this.opcoesDeConexao(), defaultJobOptions: this.opcoesPadrao() });
      this.filas.set(nome, fila);
      const criada = fila;
      const cancelar = this.metricas?.register(nome, () => contarComPrazo(criada));
      if (cancelar) {
        this.cancelarMetricas.push(cancelar);
      }
    }
    return fila;
  }

  async enfileirar<D extends DadosDoJob>(
    fila: NomeDaFila,
    nome: string,
    dados: D,
    opcoes: OpcoesDoJob = {},
  ): Promise<void> {
    if (!temTenant(dados)) {
      throw new JobSemTenantError(fila, nome);
    }
    await this.fila(fila).add(nome, dados, { jobId: opcoes.id, delay: opcoes.atrasoMs });
  }

  /** Vários jobs de uma vez (o despachante do outbox); ids repetidos não duplicam. */
  async enfileirarEmLote(fila: NomeDaFila, jobs: readonly JobParaEnfileirar[]): Promise<void> {
    for (const job of jobs) {
      if (!temTenant(job.dados)) {
        throw new JobSemTenantError(fila, job.nome);
      }
    }
    await this.fila(fila).addBulk(
      jobs.map((job) => ({ name: job.nome, data: job.dados, opts: { jobId: job.id } })),
    );
  }

  /** Chamado pelo processador na última tentativa que falhou. */
  async registrarFalha(fila: NomeDaFila, job: Job<DadosDoJob>, motivo: string): Promise<void> {
    const falha: DadosDaFalha = {
      tenantId: job.data.tenantId,
      filaDeOrigem: fila,
      jobId: job.id ?? '',
      nome: job.name,
      dados: job.data,
      motivo,
      tentativas: job.attemptsMade + 1,
    };
    await this.fila(FILA_DE_FALHAS).add(`${fila}.${job.name}`, falha, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async falhas(): Promise<Array<Job<DadosDaFalha>>> {
    return this.fila(FILA_DE_FALHAS).getJobs(['waiting', 'delayed']);
  }

  /**
   * Reprocessamento manual: devolve o job original à fila com as tentativas zeradas (ou o recria,
   * se já tiver sido removido) e tira a falha da DLQ.
   */
  async reprocessarFalha(id: string): Promise<void> {
    const falha = (await this.fila(FILA_DE_FALHAS).getJob(id)) as Job<DadosDaFalha> | undefined;
    if (!falha) {
      throw new FalhaNaoEncontradaError(id);
    }
    const { filaDeOrigem, jobId, nome, dados } = falha.data;
    const original = jobId ? await this.fila(filaDeOrigem).getJob(jobId) : undefined;
    if (original && (await original.isFailed())) {
      await original.retry('failed', { resetAttemptsMade: true, resetAttemptsStarted: true });
    } else if (!original) {
      await this.enfileirar(filaDeOrigem, nome, dados, { id: jobId || undefined });
    }
    await falha.remove();
  }

  async onModuleDestroy(): Promise<void> {
    this.cancelarMetricas.forEach((cancelar) => cancelar());
    await Promise.all([...this.filas.values()].map((fila) => fila.close()));
  }

  private opcoesPadrao(): JobsOptions {
    return {
      attempts: this.config.tentativas,
      backoff: { type: 'exponential', delay: this.config.atrasoInicialMs },
      removeOnComplete: { age: 24 * 3600, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    };
  }
}

export class FalhaNaoEncontradaError extends Error {
  constructor(readonly id: string) {
    super(`Falha ${id} não encontrada na fila de falhas.`);
    this.name = 'FalhaNaoEncontradaError';
  }
}

/** Sem Redis, a contagem falharia só depois de muito tempo: a coleta desiste em 2 s. */
function contarComPrazo(fila: Queue): Promise<Record<string, number>> {
  let prazo: NodeJS.Timeout | undefined;
  return Promise.race([
    fila.getJobCounts(),
    new Promise<never>((_, rejeitar) => {
      prazo = setTimeout(
        () => rejeitar(new Error(`contagem da fila ${fila.name} demorou demais`)),
        LEITURA_DAS_METRICAS_MS,
      );
    }),
  ]).finally(() => clearTimeout(prazo));
}
