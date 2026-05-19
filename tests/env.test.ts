import { describe, it, expect } from 'vitest';
import { envForTest } from '@/server/env';

describe('env', () => {
  it('parses valid env', () => {
    const e = envForTest();
    expect(e.BOT_USERNAME).toBe('test_bot');
    expect(e.CURRENCY).toBe('USD');
  });

  it('rejects short session secret', () => {
    expect(() => envForTest({ SESSION_SECRET: 'short' })).toThrow();
  });
});
