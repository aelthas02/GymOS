import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { EventoDeDominio } from '@gymos/shared-events';
import type { NomeDaFila } from '../../application/eventos';
import { Relogio } from '../../domain/relogio';
import { OPCOES_DA_TRANSACAO } from '../contexto/transacao-do-tenant';
import { CONFIGURACAO_DAS_FILAS, type ConfiguracaoDasFilas } from '../filas/configuracao-das-filas';
import { FilasBullMQ, type JobParaEnfileirar } from '../filas/filas.bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { type DadosDoJobDeEvento, idDoJobDeEvento, JOB_DE_EVENTO } from './entrega-de-eventos';
import { RegistroDeConsumidores } from './registro-de-consumidores';

interface LinhaDoOutbox {
  id: string;
  tenant_id: string;
  tipo: string;
  versao: number;
  payload: unknown;
  ocorrido_em: Date;
}

export interface OpcoesDoLote {
  limite?: number;
  /** Chamado com os ids reservados, com as linhas ainda travadas (métricas, testes de concorrência). */
  aoReservar?: (ids: string[]) => Promise<void>;
}

/**
 * Lê o outbox em lotes de qualquer tenant (FOR UPDATE SKIP LOCKED, pela função SECURITY DEFINER) e
 * cria um job por consumidor do evento, na fila do consumidor. Enfileirar e marcar como publicado
 * acontecem na transação da reserva: se o processo cair no meio, o lote volta a ficar livre e é
 * enfileirado de novo, com os mesmos ids de job (sem duplicar) e consumidores idempotentes.
 */
@Injectable()
export class DespachanteDoOutbox implements OnModuleDestroy {
  private readonly logger = new Logger(DespachanteDoOutbox.name);
  private ativo = false;
  private ciclo?: Promise<void>;
  private acordar?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly filas: FilasBullMQ,
    private readonly registro: RegistroDeConsumidores,
    private readonly relogio: Relogio,
    @Inject(CONFIGURACAO_DAS_FILAS) private readonly config: ConfiguracaoDasFilas,
  ) {}

  /** Despacha um lote e devolve os ids dos eventos publicados nele. */
  despacharLote({ limite = this.config.tamanhoDoLote, aoReservar }: OpcoesDoLote = {}): Promise<
    string[]
  > {
    return this.prisma.$transaction(async (tx) => {
      const linhas = await tx.$queryRaw<LinhaDoOutbox[]>`
        SELECT * FROM gymos_outbox_reservar_lote(${limite}::integer)`;
      if (linhas.length === 0) {
        return [];
      }
      const ids = linhas.map((linha) => linha.id);
      await aoReservar?.(ids);
      for (const [fila, jobs] of this.jobsPorFila(linhas)) {
        await this.filas.enfileirarEmLote(fila, jobs);
      }
      await tx.$queryRaw`
        SELECT gymos_outbox_marcar_publicados(${ids}::uuid[], ${this.relogio.agora()}::timestamptz)`;
      return ids;
    }, OPCOES_DA_TRANSACAO);
  }

  /** Laço do processo: despacha enquanto houver lote cheio e depois espera o intervalo. */
  iniciar(): void {
    if (this.ativo) {
      return;
    }
    this.ativo = true;
    this.ciclo = this.rodar();
  }

  async parar(): Promise<void> {
    this.ativo = false;
    this.acordar?.();
    await this.ciclo;
  }

  onModuleDestroy(): Promise<void> {
    return this.parar();
  }

  private async rodar(): Promise<void> {
    while (this.ativo) {
      let loteCheio = false;
      try {
        loteCheio = (await this.despacharLote()).length >= this.config.tamanhoDoLote;
      } catch (err) {
        this.logger.error({ err }, 'Falha ao despachar o outbox');
      }
      if (!loteCheio && this.ativo) {
        await new Promise<void>((resolver) => {
          const espera = setTimeout(resolver, this.config.intervaloDoDespachoMs);
          this.acordar = () => {
            clearTimeout(espera);
            resolver();
          };
        });
      }
    }
  }

  private jobsPorFila(linhas: LinhaDoOutbox[]): Map<NomeDaFila, JobParaEnfileirar[]> {
    const porFila = new Map<NomeDaFila, JobParaEnfileirar[]>();
    for (const linha of linhas) {
      const evento = {
        id: linha.id,
        tipo: linha.tipo,
        versao: linha.versao,
        tenantId: linha.tenant_id,
        ocorridoEm: linha.ocorrido_em.toISOString(),
        payload: linha.payload,
      } as EventoDeDominio;
      for (const consumidor of this.registro.doEvento(linha.tipo)) {
        const dados: DadosDoJobDeEvento = {
          tenantId: linha.tenant_id,
          consumidor: consumidor.nome,
          evento,
        };
        const jobs = porFila.get(consumidor.fila) ?? [];
        jobs.push({ nome: JOB_DE_EVENTO, dados, id: idDoJobDeEvento(consumidor.nome, linha.id) });
        porFila.set(consumidor.fila, jobs);
      }
    }
    return porFila;
  }
}
