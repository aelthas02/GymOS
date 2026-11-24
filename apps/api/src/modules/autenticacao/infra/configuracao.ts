import type { Env } from '../../../config/env';

export interface ConfiguracaoDaAutenticacao {
  /** Segredo HS256 do token de acesso (32 caracteres ou mais). */
  segredoDoJwt: string;
  urlDoRedis: string;
  /** Prefixo das chaves do limite de tentativas no Redis; os testes usam um por execução. */
  prefixoDoRedis: string;
  /** Endereço do app do aluno com `{tenant}` no lugar do slug. */
  urlDoApp: string;
  /** `fake` guarda os e-mails em memória (testes e máquinas sem Mailpit). */
  transporteDeEmail: 'smtp' | 'fake';
  smtp: { host: string; porta: number };
  remetente: string;
}

export const CONFIGURACAO_DA_AUTENTICACAO = Symbol('ConfiguracaoDaAutenticacao');

export function configuracaoDaAutenticacao(env: Env): ConfiguracaoDaAutenticacao {
  return {
    segredoDoJwt: env.AUTH_JWT_SECRET,
    urlDoRedis: env.REDIS_URL,
    prefixoDoRedis: 'gymos',
    urlDoApp: env.STUDENT_APP_URL,
    transporteDeEmail: env.EMAIL_TRANSPORTE,
    smtp: { host: env.SMTP_HOST, porta: env.SMTP_PORT },
    remetente: env.EMAIL_REMETENTE,
  };
}
