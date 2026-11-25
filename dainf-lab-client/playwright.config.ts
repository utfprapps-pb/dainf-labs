import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;

/**
 * E2E com API mockada (ver e2e/mock-api). O front é servido pelo `ng serve`;
 * o `apiUrl` vem de /config/config.json, interceptado em cada teste.
 */
export default defineConfig({
  testDir: './e2e/specs',
  outputDir: './e2e/.results',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/.report' }],
    ...(process.env['CI'] ? ([['junit', { outputFile: 'e2e/.junit/results.xml' }]] as const) : []),
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
  },
});
