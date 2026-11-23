import type { AppEnvironment } from '@gymos/shared-ambiente';

export const environment: AppEnvironment = {
  name: 'staging',
  production: false,
  // DSN pública do projeto student-app no Sentry; vazia desliga o Sentry.
  sentryDsn: '',
};
