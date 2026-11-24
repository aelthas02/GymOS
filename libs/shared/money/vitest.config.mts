import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/money',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'shared-money',
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
      reportsDirectory: '../../../coverage/libs/shared/money',
      include: ['src/**/*.ts'],
      // Portão de cobertura (T03): só vale com GYMOS_COBERTURA=true (`pnpm cobertura`); o `test` padrão não falha por limite.
      // Utilitário puro: 100% exigido pelo item 8 do prompt (o portão do CI é do T03).
      thresholds:
        process.env['GYMOS_COBERTURA'] === 'true'
          ? { lines: 100, branches: 100, functions: 100, statements: 100 }
          : undefined,
    },
  },
}));
