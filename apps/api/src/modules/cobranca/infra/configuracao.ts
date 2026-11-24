import type { Env } from '../../../config/env';

export interface ConfiguracaoDosPagamentos {
  provedor: Env['PAGAMENTOS_PROVEDOR'];
  segredoDoWebhook: string;
  /** Endereço público da API (páginas de pagamento simuladas do fake). */
  urlPublica: string;
}

export const CONFIGURACAO_DOS_PAGAMENTOS = Symbol('ConfiguracaoDosPagamentos');

/** Sem `ENV` (módulos de teste que não carregam o ambiente), valem os padrões de desenvolvimento. */
export function configuracaoDosPagamentos(env: Env | undefined): ConfiguracaoDosPagamentos {
  return {
    provedor: env?.PAGAMENTOS_PROVEDOR ?? 'fake',
    segredoDoWebhook: env?.PAGAMENTOS_WEBHOOK_SEGREDO ?? 'gymos-dev-segredo-dos-webhooks',
    urlPublica: (env?.PAGAMENTOS_URL_PUBLICA ?? 'http://localhost:3000').replace(/\/+$/, ''),
  };
}
