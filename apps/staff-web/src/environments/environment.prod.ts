import type { AppEnvironment } from '@gymos/shared-ambiente';

export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  // DSN pública do projeto staff-web no Sentry; vazia desliga o Sentry.
  sentryDsn: '',
};
