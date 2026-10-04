import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real app: Next.js + NestJS + Postgres + Redis
 * with the demo seed loaded (`npm run db:seed`).
 *
 * Locally they reuse the dev servers if they're running; in CI Playwright
 * starts the production builds itself.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3300';
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // tests share one seeded database
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'npm run start:prod -w @crewline/api',
      cwd: '..',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
    {
      command: 'npm run start -w @crewline/web',
      cwd: '..',
      url: baseURL,
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
  ],
});
