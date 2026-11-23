import type { AppEnvironment } from '@gymos/shared-ambiente';

export const environment: AppEnvironment = {
  name: 'development',
  production: false,
  // DSN pública do projeto staff-web no Sentry; vazia desliga o Sentry.
  sentryDsn: '',
};
