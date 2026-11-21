import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/architecture',
  test: {
    name: 'architecture',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    reporters: ['default'],
  },
}));
