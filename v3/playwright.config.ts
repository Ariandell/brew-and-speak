import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4174';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(baseURL)) throw new Error('E2E дозволено запускати лише локально.');

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL,
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4174',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
