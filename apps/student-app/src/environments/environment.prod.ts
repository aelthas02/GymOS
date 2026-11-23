import type { AppEnvironment } from '@gymos/shared-ambiente';

export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  // DSN pública do projeto student-app no Sentry; vazia desliga o Sentry.
  sentryDsn: '',
};
