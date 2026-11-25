import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/automatic',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/functional.xml' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:15173',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: process.platform === 'win32'
        ? 'gradlew.bat bootE2e --console=plain'
        : 'sh ./gradlew bootE2e --console=plain',
      cwd: '../api',
      url: 'http://127.0.0.1:18081/productos',
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 15173 --strictPort',
      url: 'http://127.0.0.1:15173',
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:18081',
        VITE_INVENTORY_MODE: 'api',
        VITE_INVENTORY_ENDPOINT: '/productos',
      },
    },
  ],
});
