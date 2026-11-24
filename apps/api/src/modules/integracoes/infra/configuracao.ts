import { createHmac } from 'node:crypto';
import type { Env } from '../../../config/env';

export interface ConfiguracaoDasIntegracoes {
  metaProvedor: Env['META_PROVEDOR'];
  mensageriaTransporte: Env['MENSAGERIA_TRANSPORTE'];
  iaProvedor: Env['IA_PROVEDOR'];
  armazenamento: Env['ARMAZENAMENTO'];
  segredoDoWebhook: string;
  /** Deriva do segredo do JWT: assina o `state` do fluxo da Meta e as URLs do armazenamento fake. */
  segredoInterno: string;
  /** Endereço público da API, usado nas URLs assinadas do armazenamento fake. */
  urlPublica: string;
  s3: {
    endpoint: string;
    regiao: string;
    bucket: string;
    chaveDeAcesso: string;
    segredo: string;
  };
}

export const CONFIGURACAO_DAS_INTEGRACOES = Symbol('ConfiguracaoDasIntegracoes');

/** Sem `ENV` (módulos de teste que não carregam o ambiente), valem os padrões de desenvolvimento. */
export function configuracaoDasIntegracoes(env: Env | undefined): ConfiguracaoDasIntegracoes {
  return {
    metaProvedor: env?.META_PROVEDOR ?? 'fake',
    mensageriaTransporte: env?.MENSAGERIA_TRANSPORTE ?? 'fake',
    iaProvedor: env?.IA_PROVEDOR ?? 'fake',
    armazenamento: env?.ARMAZENAMENTO ?? 'fake',
    segredoDoWebhook: env?.MENSAGERIA_WEBHOOK_SEGREDO ?? 'gymos-dev-segredo-da-mensageria',
    segredoInterno: createHmac('sha256', env?.AUTH_JWT_SECRET ?? 'gymos-dev-segredo-do-jwt')
      .update('integracoes')
      .digest('hex'),
    urlPublica: (env?.ARMAZENAMENTO_URL_PUBLICA ?? 'http://localhost:3000').replace(/\/+$/, ''),
    s3: {
      endpoint: (env?.S3_ENDPOINT ?? 'http://localhost:9000').replace(/\/+$/, ''),
      regiao: env?.S3_REGION ?? 'us-east-1',
      bucket: env?.S3_BUCKET ?? 'gymos',
      chaveDeAcesso: env?.S3_ACCESS_KEY_ID ?? 'gymos',
      segredo: env?.S3_SECRET_ACCESS_KEY ?? 'gymos-dev-secret',
    },
  };
}
