import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/turnstile-agent',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'turnstile-agent',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      enabled: true,
      provider: 'v8' as const,
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: '../../coverage/apps/turnstile-agent',
      include: ['src/**/*.ts'],
      // Portão de cobertura (T03): só vale com GYMOS_COBERTURA=true (`pnpm cobertura`); o `test` padrão não falha por limite.
      // Portão do CI (T03): 85% de linhas e 80% de branches no geral; 100% nas pastas de regra.
      thresholds:
        process.env['GYMOS_COBERTURA'] === 'true'
          ? {
              lines: 85,
              branches: 80,
              '**/src/domain/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
            }
          : undefined,
    },
  },
}));
