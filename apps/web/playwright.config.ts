import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4180',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'pnpm exec serve out -l 4180 --no-clipboard',
    url: 'http://localhost:4180',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
