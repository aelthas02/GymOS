import { Injectable, Logger } from '@nestjs/common';
import type { EventoDeDominio } from '@gymos/shared-events';
import type { DadosDoJob } from '../../application/eventos';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { RegistroDeConsumidores } from './registro-de-consumidores';

/** Nome do job que entrega um evento a um consumidor. */
export const JOB_DE_EVENTO = 'evento';

export interface DadosDoJobDeEvento extends DadosDoJob {
  consumidor: string;
  evento: EventoDeDominio;
}

/** Um job por (consumidor, evento): reenfileirar o mesmo evento não duplica o job. */
export function idDoJobDeEvento(consumidor: string, eventoId: string): string {
  return `${consumidor}@${eventoId}`;
}

export class ConsumidorDesconhecidoError extends Error {
  constructor(readonly consumidor: string) {
    super(`Consumidor ${consumidor} não está registrado neste processo.`);
    this.name = 'ConsumidorDesconhecidoError';
  }
}

/**
 * Efeito exatamente uma vez sobre entrega pelo menos uma vez: a marca em evento_processado e o efeito
 * do consumidor estão na mesma transação do tenant. Se a marca já existe, o evento é ignorado; se o
 * consumidor falha, a marca é desfeita junto com o efeito e a nova tentativa trata de novo.
 */
@Injectable()
export class EntregaDeEventos {
  private readonly logger = new Logger(EntregaDeEventos.name);

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly contexto: ContextoDoTenant,
    private readonly registro: RegistroDeConsumidores,
  ) {}

  /** Devolve false quando o evento já tinha sido processado por aquele consumidor. */
  entregar({ tenantId, consumidor: nome, evento }: DadosDoJobDeEvento): Promise<boolean> {
    const consumidor = this.registro.consumidor(nome);
    if (!consumidor) {
      throw new ConsumidorDesconhecidoError(nome);
    }
    if (evento.tenantId !== tenantId) {
      throw new Error(`Evento ${evento.id} é de outro tenant que o do job.`);
    }
    return this.executor.runAsTenant(tenantId, async () => {
      // Com duas entregas simultâneas, a segunda espera a primeira na chave primária e, depois do
      // commit dela, não insere nada.
      const { count } = await this.contexto.cliente().eventoProcessado.createMany({
        data: [{ consumidor: nome, eventoId: evento.id, tenantId }],
        skipDuplicates: true,
      });
      if (count === 0) {
        this.logger.debug({ consumidor: nome, eventoId: evento.id }, 'Evento já processado');
        return false;
      }
      await consumidor.tratar(evento);
      return true;
    });
  }
}
