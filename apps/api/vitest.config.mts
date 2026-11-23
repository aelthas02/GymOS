import { defineConfig } from 'vitest/config';

const integracao = '**/*.int.spec.ts';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  // O Nest injeta dependências pelo tipo do construtor: precisa dos metadados de decorators.
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      enabled: true,
      provider: 'v8' as const,
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: '../../coverage/apps/api',
      exclude: ['src/generated/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'api',
          include: ['{src,generators}/**/*.spec.ts'],
          exclude: [integracao],
        },
      },
      {
        // Integração contra o Postgres de TEST_DATABASE_ADMIN_URL (ver README, "Testes de integração").
        extends: true,
        test: {
          name: 'api-integracao',
          include: [`{src,generators}/${integracao}`],
          globalSetup: ['src/modules/platform/testing/banco.global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
}));
