import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4175';
if (!baseURL.startsWith('http://127.0.0.1:')) throw new Error('Production UI E2E may only use loopback.');

export default defineConfig({
  testDir: './tests/production',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  outputDir: './node_modules/.cache/production-e2e/results',
  reporter: [['list'], ['html', { outputFolder: './node_modules/.cache/production-e2e/report', open: 'never' }]],
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [{
    command: 'tsx server/scripts/e2eProductionServer.ts',
    url: 'http://127.0.0.1:3000/api/v2/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...process.env, E2E_PRODUCTION_HARNESS: '1' },
  }, {
    command: 'vite --host 127.0.0.1 --port 4175',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  }],
});
