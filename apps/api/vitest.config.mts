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
    // Vários testes sobem a aplicação Nest numa porta; a primeira carga é lenta com o CI ocupado.
    testTimeout: 15_000,
    reporters: ['default'],
    coverage: {
      enabled: true,
      provider: 'v8' as const,
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: '../../coverage/apps/api',
      include: ['src/**/*.ts'],
      // Pontos de entrada (bootstrap e CLIs) e utilitários de teste não entram no portão.
      exclude: [
        'src/generated/**',
        'src/**/*.spec.ts',
        'src/**/*.main.ts',
        'src/main.ts',
        'src/instrument.ts',
        'src/**/testing/**',
      ],
      // Portão do CI (T03): 85% de linhas e 80% de branches no geral; 100% nas pastas de regra.
      thresholds: {
        lines: 85,
        branches: 80,
        '**/domain/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
    projects: [
      {
        extends: true as const,
        test: {
          name: 'api',
          include: ['{src,generators}/**/*.spec.ts'],
          exclude: [integracao],
        },
      },
      {
        // Integração contra o Postgres de TEST_DATABASE_ADMIN_URL (ver README, "Testes de integração").
        extends: true as const,
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
