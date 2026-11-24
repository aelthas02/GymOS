/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/ambiente',
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [angular()],
  test: {
    name: 'shared-ambiente',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      enabled: true,
      provider: 'v8' as const,
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: '../../../coverage/libs/shared/ambiente',
      include: ['src/**/*.ts'],
      // Portão de cobertura (T03): só vale com GYMOS_COBERTURA=true (`pnpm cobertura`); o `test` padrão não falha por limite.
      // Portão do CI (T03): 85% de linhas e 80% de branches no geral; 100% nas pastas de regra.
      thresholds:
        process.env['GYMOS_COBERTURA'] === 'true' ? { lines: 85, branches: 80 } : undefined,
    },
  },
}));
