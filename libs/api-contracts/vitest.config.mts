import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/api-contracts',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'api-contracts',
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
      reportsDirectory: '../../coverage/libs/api-contracts',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/**/*.spec.ts'],
      // Portão de cobertura (T03): só vale com GYMOS_COBERTURA=true (`pnpm cobertura`); o `test` padrão não falha por limite.
      // Portão do CI (T03): 85% de linhas e 80% de branches no geral; 100% nas pastas de regra.
      thresholds:
        process.env['GYMOS_COBERTURA'] === 'true' ? { lines: 85, branches: 80 } : undefined,
    },
  },
}));
