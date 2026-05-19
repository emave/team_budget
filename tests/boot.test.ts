import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('boot', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SKIP_BOT = '1';
    process.env.SKIP_CRON = '1';
    process.env.NODE_ENV = 'test';
    process.env.BOT_TOKEN = 'test:0123456789';
    process.env.BOT_USERNAME = 'test_bot';
    process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.SESSION_SECRET = 'a'.repeat(32);
  });

  it('reaches ready state', async () => {
    const { bootOnce, getBootState } = await import('@/server/boot');
    await bootOnce();
    expect(getBootState()).toBe('ready');
  });

  it('is idempotent', async () => {
    const { bootOnce } = await import('@/server/boot');
    const p1 = bootOnce();
    const p2 = bootOnce();
    expect(p1).toBe(p2);
    await p1;
  });
});
