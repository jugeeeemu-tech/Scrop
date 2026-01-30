import { defineConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '3000';
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
  },
  webServer: {
    command: `cargo run -p scrop-server --no-default-features -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
