import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/events',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'shared-events',
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
      reportsDirectory: '../../../coverage/libs/shared/events',
      include: ['src/**/*.ts'],
      // Contrato puro entre domínios: 100%, como os outros pacotes de libs/shared.
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
}));
