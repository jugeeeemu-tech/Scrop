import { defineConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '3000';
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'default',
      use: { browserName: 'chromium' },
      testIgnore: /nic-attach/,
    },
    {
      name: 'nic-attach',
      use: { browserName: 'chromium' },
      testMatch: /nic-attach/,
      dependencies: ['default'],
    },
  ],
  webServer: {
    command: `cargo run -p scrop-server --no-default-features -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
