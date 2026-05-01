import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for cozza-ai PWA E2E.
 * Skipped in CI by default. Run locally with `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pixel-10a',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        userAgent:
          'Mozilla/5.0 (Linux; Android 15; Pixel 10a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
