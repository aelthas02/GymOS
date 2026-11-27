import type { Env } from '../../../config/env';

export interface ConfiguracaoDoFiscal {
  provedor: Env['FISCAL_PROVEDOR'];
  /** Assina os webhooks do emissor (HMAC-SHA256 do corpo em `x-assinatura`). */
  segredoDoWebhook: string;
}

export const CONFIGURACAO_DO_FISCAL = Symbol('ConfiguracaoDoFiscal');

/** Sem `ENV` (módulos de teste que não carregam o ambiente), valem os padrões de desenvolvimento. */
export function configuracaoDoFiscal(env: Env | undefined): ConfiguracaoDoFiscal {
  return {
    provedor: env?.FISCAL_PROVEDOR ?? 'fake',
    segredoDoWebhook: env?.FISCAL_WEBHOOK_SEGREDO ?? 'gymos-dev-segredo-do-emissor-fiscal',
  };
}
