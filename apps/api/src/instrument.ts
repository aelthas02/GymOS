// Primeiro import do main.ts: o Sentry precisa iniciar antes de o Nest e o Express serem carregados
// para instrumentá-los. Com o ambiente inválido não inicia; o bootstrap registra o erro e encerra.
import * as Sentry from '@sentry/nestjs';
import { parseEnv } from './config/env';
import { sentryOptions } from './observabilidade/sentry/sentry-options';

const result = parseEnv(process.env);
const options = result.ok ? sentryOptions(result.env) : undefined;
if (options) {
  Sentry.init(options);
}
