import type { Env } from '../../../config/env';

export interface ConfiguracaoDaPlataforma {
  ambiente: Env['NODE_ENV'];
  /** Conexão do papel gymos_app (sem BYPASSRLS). */
  urlDoBanco: string;
  /** Domínio sob o qual cada academia tem o seu subdomínio (`localhost` em dev). */
  dominioBase: string;
  /** Chave do endpoint interno de operação; sem ela, o endpoint responde 404. */
  chaveDeOperacao: string | undefined;
  /** Endereço do painel com `{tenant}` no lugar do slug. */
  urlDoPainel: string;
}

export const CONFIGURACAO_DA_PLATAFORMA = Symbol('ConfiguracaoDaPlataforma');

export function configuracaoDoAmbiente(env: Env): ConfiguracaoDaPlataforma {
  return {
    ambiente: env.NODE_ENV,
    urlDoBanco: env.DATABASE_URL,
    dominioBase: env.TENANT_BASE_DOMAIN,
    chaveDeOperacao: env.OPERACAO_API_KEY,
    urlDoPainel: env.STAFF_WEB_URL,
  };
}

/** Cabeçalhos de apoio (x-tenant, x-relogio) e o provedor de webhook fake: só fora de produção. */
export function permiteRecursosDeDesenvolvimento(config: ConfiguracaoDaPlataforma): boolean {
  return config.ambiente !== 'production';
}
