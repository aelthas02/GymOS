import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/acesso',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'shared-acesso',
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
      reportsDirectory: '../../../coverage/libs/shared/acesso',
      include: ['src/**/*.ts'],
      // Regras de acesso puras (API e agente): 100%, como os outros pacotes de libs/shared.
      thresholds:
        process.env['GYMOS_COBERTURA'] === 'true'
          ? { lines: 100, branches: 100, functions: 100, statements: 100 }
          : undefined,
    },
  },
}));
