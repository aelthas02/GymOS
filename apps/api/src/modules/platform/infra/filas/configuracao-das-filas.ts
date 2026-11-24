import type { Env } from '../../../../config/env';

export interface ConfiguracaoDasFilas {
  urlDoRedis: string;
  /** Prefixo de tudo no Redis (filas, cache e canais): separa ambientes e execuções de teste. */
  prefixo: string;
  /** Sobe os workers e o despachante do outbox neste processo. */
  processar: boolean;
  /** Painel das filas em /interno/filas: dev e staging, no processo dos workers, com a chave de operação. */
  painel: boolean;
  /** Tentativas de cada job antes da fila de falhas. */
  tentativas: number;
  /** Atraso da primeira nova tentativa; dobra a cada falha. */
  atrasoInicialMs: number;
  intervaloDoDespachoMs: number;
  tamanhoDoLote: number;
}

export const CONFIGURACAO_DAS_FILAS = Symbol('ConfiguracaoDasFilas');

export function configuracaoDasFilas(env: Env): ConfiguracaoDasFilas {
  return {
    urlDoRedis: env.REDIS_URL,
    prefixo: env.REDIS_PREFIXO,
    processar: env.FILAS_PROCESSAR,
    painel: env.APP_ENV !== 'production' && env.FILAS_PROCESSAR,
    tentativas: 5,
    atrasoInicialMs: 2_000,
    intervaloDoDespachoMs: 1_000,
    tamanhoDoLote: 100,
  };
}
