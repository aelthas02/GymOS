import type { EventoDeDominio, NovoEvento, TipoDeEvento } from '@gymos/shared-events';

// Portas de eventos, filas, cache e tempo real (ADR-007, T13a). Casos de uso dependem destas classes;
// as implementações (outbox no Postgres, BullMQ e Redis) ficam em infra e são do EventosModule.

/**
 * Grava o evento no outbox na transação do caso de uso, com o tenant do contexto. Rollback do caso
 * de uso descarta o evento; o despachante só vê o que foi confirmado.
 */
export abstract class PublicadorDeEventos {
  abstract publicar<T extends TipoDeEvento>(evento: NovoEvento<T>): Promise<EventoDeDominio<T>>;
}

/** Filas BullMQ por tipo de trabalho. `falhas` é a fila de falhas (DLQ), sem worker. */
export const FILAS = [
  'eventos',
  'cobranca',
  'notas',
  'mensagens',
  'importacao',
  'notificacoes',
] as const;
export type NomeDaFila = (typeof FILAS)[number];

/** Todo job carrega o tenant: o worker o executa em runAsTenant. */
export interface DadosDoJob {
  tenantId: string;
  [campo: string]: unknown;
}

export interface OpcoesDoJob {
  /** Id estável: enfileirar de novo com o mesmo id não duplica o job. */
  id?: string;
  atrasoMs?: number;
}

export class JobSemTenantError extends Error {
  constructor(fila: string, nome: string) {
    super(`Job ${nome} recusado na fila ${fila}: todo job precisa de tenantId.`);
    this.name = 'JobSemTenantError';
  }
}

export abstract class Filas {
  /** Recusa (JobSemTenantError) o job sem tenantId, antes de tocar o Redis. */
  abstract enfileirar<D extends DadosDoJob>(
    fila: NomeDaFila,
    nome: string,
    dados: D,
    opcoes?: OpcoesDoJob,
  ): Promise<void>;
}

/**
 * Consumidor de um evento. O nome é estável (`dominio.acao`, ex.: `fiscal.emitir-nota`): com o id do
 * evento, é a chave de idempotência. `tratar` roda em runAsTenant, na mesma transação da marca de
 * processado; o efeito no banco usa `ContextoDoTenant.cliente()` e some junto se `tratar` falhar.
 */
export interface ConsumidorDeEvento<T extends TipoDeEvento = TipoDeEvento> {
  nome: string;
  evento: T;
  /** Fila em que o consumidor roda; `eventos` quando não houver fila própria do trabalho. */
  fila?: NomeDaFila;
  tratar(evento: EventoDeDominio<T>): Promise<void>;
}

/** Parte de uma chave lógica de cache: o tenant é sempre o do contexto, nunca uma parte. */
export type ParteDaChave = string | number;

export interface OpcoesDoCache {
  ttlSegundos: number;
}

/** Cache no Redis sempre sob o tenant do contexto (`chaveDeCache`). */
export abstract class CacheComTenant {
  /** Devolve o valor guardado ou carrega, guarda por `ttlSegundos` e devolve. */
  abstract obter<T>(
    chave: readonly ParteDaChave[],
    carregar: () => Promise<T>,
    opcoes: OpcoesDoCache,
  ): Promise<T>;
  abstract invalidar(chave: readonly ParteDaChave[]): Promise<void>;
  /**
   * Registra um consumidor que, a cada evento do tipo, apaga as chaves devolvidas por `chaves`, no
   * tenant do evento.
   */
  abstract invalidarAoReceber<T extends TipoDeEvento>(
    evento: T,
    nomeDoConsumidor: string,
    chaves: (evento: EventoDeDominio<T>) => ReadonlyArray<readonly ParteDaChave[]>,
  ): void;
}

/** Pub/sub no canal `tenant:<id>:<topico>`, sempre do tenant do contexto. */
export abstract class TempoRealPorTenant {
  abstract publicar(topico: string, mensagem: unknown): Promise<void>;
  /** Devolve a função que cancela a assinatura. */
  abstract assinar(
    topico: string,
    aoReceber: (mensagem: unknown) => void,
  ): Promise<() => Promise<void>>;
}
