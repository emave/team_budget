import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: 'data/team_budget.test.db',
      BOT_TOKEN: 'test:0123456789',
      BOT_USERNAME: 'test_bot',
      BOOTSTRAP_ADMIN_TELEGRAM_ID: '1',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
      CURRENCY: 'USD',
      SESSION_SECRET: 'a'.repeat(32),
      SKIP_BOT: '1',
      SKIP_CRON: '1',
    },
  },
});
