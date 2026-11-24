import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65_535);
const required = z.string().trim().min(1);

// Variável opcional: vazia no .env vale como não definida.
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Ambiente de implantação; staging roda com NODE_ENV=production.
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  API_PORT: port.default(3000),
  // Quantos proxies confiáveis ficam na frente da API (ingress, CDN); define o IP do cliente e,
  // com ele, os limites de login por IP (T12). 0 ignora o X-Forwarded-For.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SENTRY_DSN: optional(z.url({ protocol: /^https?$/ })),
  SENTRY_RELEASE: optional(required),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  TENANT_BASE_DOMAIN: required.default('localhost'),
  STAFF_WEB_URL: required.default('http://{tenant}.localhost:4200'),
  // Vazia desliga o endpoint interno de operação; definida, exige 32 caracteres ou mais.
  OPERACAO_API_KEY: optional(z.string().min(32)),
  // Segredo HS256 do token de acesso (T12); 32 caracteres ou mais, diferente por ambiente.
  AUTH_JWT_SECRET: z.string().min(32),
  // Endereço do app do aluno de cada academia, usado nos links de e-mail; {tenant} vira o slug.
  STUDENT_APP_URL: required.default('http://{tenant}.localhost:4300'),
  // Chave mestra local da cifra de campos (T13c, ADR-015): 32 bytes em base64. Só em dev, teste e
  // staging; produção usa o KMS. Gere com `node -e "console.log(crypto.randomBytes(32).toString('base64'))"`.
  CHAVE_MESTRA_LOCAL: optional(
    z.base64().refine((valor) => Buffer.from(valor, 'base64').length === 32, {
      message: 'deve ter 32 bytes em base64',
    }),
  ),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  // Prefixo de filas, cache e canais no Redis; separa ambientes que dividem o mesmo Redis.
  REDIS_PREFIXO: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .default('gymos'),
  // Sobe os workers das filas e o despachante do outbox neste processo.
  FILAS_PROCESSAR: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
  SMTP_HOST: required,
  SMTP_PORT: port,
  // smtp envia pelo SMTP_HOST; fake só guarda em memória (máquina sem Mailpit).
  EMAIL_TRANSPORTE: z.enum(['smtp', 'fake']).default('smtp'),
  EMAIL_REMETENTE: required.default('GymOS <nao-responda@gymos.app>'),
  // Provedor de pagamento (T19, ADR-009). Só o fake até o provedor real ser escolhido.
  PAGAMENTOS_PROVEDOR: z.enum(['fake']).default('fake'),
  // Segredo da assinatura HMAC dos webhooks do provedor; 16 caracteres ou mais.
  PAGAMENTOS_WEBHOOK_SEGREDO: z.string().min(16).default('gymos-dev-segredo-dos-webhooks'),
  // Endereço público da API, usado nas páginas de pagamento simuladas do fake.
  PAGAMENTOS_URL_PUBLICA: required.default('http://localhost:3000'),
  S3_ENDPOINT: z.url({ protocol: /^https?$/ }),
  S3_REGION: required,
  S3_BUCKET: required,
  S3_ACCESS_KEY_ID: required,
  S3_SECRET_ACCESS_KEY: required,
});

export type Env = z.infer<typeof envSchema>;

export interface EnvIssue {
  variable: string;
  message: string;
}

export type EnvParseResult = { ok: true; env: Env } | { ok: false; issues: EnvIssue[] };

const portugueseMessages = z.locales.pt().localeError;

export function parseEnv(source: Record<string, string | undefined>): EnvParseResult {
  const result = envSchema.safeParse(source, { error: portugueseMessages });
  if (result.success) {
    return { ok: true, env: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const variable = issue.path.join('.');
      const message = source[variable] === undefined ? 'obrigatória e não definida' : issue.message;
      return { variable, message };
    }),
  };
}

export class InvalidEnvError extends Error {
  constructor(readonly issues: EnvIssue[]) {
    const lines = issues.map((issue) => `  - ${issue.variable}: ${issue.message}`);
    super(['Variáveis de ambiente inválidas ou ausentes:', ...lines].join('\n'));
    this.name = 'InvalidEnvError';
  }
}

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = parseEnv(source);
  if (!result.ok) {
    throw new InvalidEnvError(result.issues);
  }
  return result.env;
}
