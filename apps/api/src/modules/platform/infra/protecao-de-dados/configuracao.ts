import type { Env } from '../../../../config/env';

export interface ConfiguracaoDaCifra {
  /** Chave mestra local (32 bytes em base64); sem ela, o provedor é o KMS. */
  chaveMestraLocal: string | undefined;
}

export const CONFIGURACAO_DA_CIFRA = Symbol('ConfiguracaoDaCifra');

export class ProvedorDeChavesIndisponivelError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ProvedorDeChavesIndisponivelError';
  }
}

/** Produção nunca usa a chave local: a chave mestra fica no KMS (ADR-015). */
export function configuracaoDaCifra(env: Env): ConfiguracaoDaCifra {
  if (env.APP_ENV === 'production' && env.CHAVE_MESTRA_LOCAL) {
    throw new ProvedorDeChavesIndisponivelError(
      'CHAVE_MESTRA_LOCAL não é aceita em produção: a chave mestra fica no KMS.',
    );
  }
  return { chaveMestraLocal: env.CHAVE_MESTRA_LOCAL };
}
