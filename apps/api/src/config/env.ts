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
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SENTRY_DSN: optional(z.url({ protocol: /^https?$/ })),
  SENTRY_RELEASE: optional(required),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  TENANT_BASE_DOMAIN: required.default('localhost'),
  STAFF_WEB_URL: required.default('http://{tenant}.localhost:4200'),
  // Vazia desliga o endpoint interno de operação; definida, exige 32 caracteres ou mais.
  OPERACAO_API_KEY: optional(z.string().min(32)),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  SMTP_HOST: required,
  SMTP_PORT: port,
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
