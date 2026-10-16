import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The editor tests render large forms. On a busy machine (other packages' tests run alongside) a test needs far more
    // than vitest's 5 seconds, and a slow test is not a broken one.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Leave room for the other packages' test runs instead of taking every core.
    pool: 'forks',
    poolOptions: { forks: { maxForks: 4, minForks: 1 } },
  },
});
