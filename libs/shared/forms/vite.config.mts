/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/forms',
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [angular()],
  test: {
    name: 'shared-forms',
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
      reportsDirectory: '../../../coverage/libs/shared/forms',
      include: ['src/**/*.ts'],
      exclude: ['src/test-setup.ts'],
      // Portão de cobertura (T03): só vale com GYMOS_COBERTURA=true (`pnpm cobertura`); o `test` padrão não falha por limite.
      // Utilitário puro: 100% exigido pelo item 8 do prompt (o portão do CI é do T03).
      thresholds:
        process.env['GYMOS_COBERTURA'] === 'true'
          ? { lines: 100, branches: 100, functions: 100, statements: 100 }
          : undefined,
    },
  },
}));
