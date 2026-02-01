import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    exclude: ['e2e/**', 'perf/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
    },
  },
});
