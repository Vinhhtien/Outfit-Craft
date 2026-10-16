import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 15000 }, reporter: 'list',
  use: { baseURL: 'http://localhost:3100', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', viewport: { width: 1365, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  // Explicit opt-in for environments that manage the test server themselves.
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1' ? undefined : { command: 'node node_modules/next/dist/bin/next dev --port 3100', url: 'http://localhost:3100', reuseExistingServer: false, timeout: 180000, env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:5100/api' } },
});
