import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Job, Worker, type WorkerOptions } from 'bullmq';
import type { DadosDoJob, NomeDaFila } from '../../application/eventos';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import {
  type DadosDoJobDeEvento,
  EntregaDeEventos,
  JOB_DE_EVENTO,
} from '../eventos/entrega-de-eventos';
import { FilasBullMQ } from './filas.bullmq';

export type Trabalho<D extends DadosDoJob = DadosDoJob> = (dados: D, job: Job<D>) => Promise<void>;

export class TrabalhoDesconhecidoError extends Error {
  constructor(fila: string, nome: string) {
    super(`Nenhum trabalho ${nome} registrado na fila ${fila}.`);
    this.name = 'TrabalhoDesconhecidoError';
  }
}

/**
 * Workers das filas. Jobs de evento vão para a EntregaDeEventos; os demais, para o trabalho
 * registrado com o nome do job, sempre em runAsTenant. Na última tentativa que falha, o job é
 * copiado para a fila de falhas com o motivo antes de ser marcado como falho.
 */
@Injectable()
export class ProcessadorDeFilas implements OnModuleDestroy {
  private readonly logger = new Logger(ProcessadorDeFilas.name);
  private readonly trabalhos = new Map<string, Trabalho>();
  private readonly workers: Worker[] = [];

  constructor(
    private readonly filas: FilasBullMQ,
    private readonly entrega: EntregaDeEventos,
    private readonly executor: ExecutorDeTenant,
  ) {}

  registrarTrabalho<D extends DadosDoJob>(
    fila: NomeDaFila,
    nome: string,
    trabalho: Trabalho<D>,
  ): void {
    this.trabalhos.set(`${fila}/${nome}`, trabalho as Trabalho);
  }

  async processar(fila: NomeDaFila, job: Job<DadosDoJob>): Promise<void> {
    try {
      if (job.name === JOB_DE_EVENTO) {
        await this.entrega.entregar(job.data as DadosDoJobDeEvento);
        return;
      }
      const trabalho = this.trabalhos.get(`${fila}/${job.name}`);
      if (!trabalho) {
        throw new TrabalhoDesconhecidoError(fila, job.name);
      }
      await this.executor.runAsTenant(job.data.tenantId, () => trabalho(job.data, job));
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        const motivo = error instanceof Error ? error.message : String(error);
        await this.filas.registrarFalha(fila, job, motivo);
        this.logger.error({ err: error, fila, jobId: job.id }, 'Job enviado à fila de falhas');
      }
      throw error;
    }
  }

  iniciarWorker(fila: NomeDaFila, opcoes: Partial<WorkerOptions> = {}): Worker {
    const worker = new Worker<DadosDoJob>(fila, (job) => this.processar(fila, job), {
      ...this.filas.opcoesDeConexao(),
      concurrency: 5,
      ...opcoes,
    });
    worker.on('error', (err) => this.logger.warn({ err, fila }, 'Erro no worker'));
    this.workers.push(worker);
    return worker;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.splice(0).map((worker) => worker.close()));
  }
}
