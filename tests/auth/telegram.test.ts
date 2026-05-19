import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { verifyTelegramAuth, type TelegramAuthData } from '@/server/auth/telegram';

function sign(data: TelegramAuthData, botToken: string): TelegramAuthData {
  const secretKey = createHash('sha256').update(botToken).digest();
  const fields = Object.entries(data)
    .filter(([k, v]) => k !== 'hash' && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const hash = createHmac('sha256', secretKey).update(fields).digest('hex');
  return { ...data, hash };
}

describe('verifyTelegramAuth', () => {
  const BOT_TOKEN = 'test:0123456789';
  const now = Math.floor(Date.now() / 1000);

  it('accepts a valid signature', () => {
    const data = sign(
      { id: 42, first_name: 'Alice', auth_date: now },
      BOT_TOKEN,
    );
    const result = verifyTelegramAuth(data, BOT_TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(42);
  });

  it('rejects tampered payload', () => {
    const data = sign({ id: 42, first_name: 'Alice', auth_date: now }, BOT_TOKEN);
    const tampered = { ...data, first_name: 'Bob' };
    const result = verifyTelegramAuth(tampered, BOT_TOKEN);
    expect(result.ok).toBe(false);
  });

  it('rejects expired auth_date (>1 day old)', () => {
    const old = now - 60 * 60 * 25;
    const data = sign({ id: 42, first_name: 'Alice', auth_date: old }, BOT_TOKEN);
    const result = verifyTelegramAuth(data, BOT_TOKEN);
    expect(result.ok).toBe(false);
  });

  it('rejects missing hash', () => {
    const result = verifyTelegramAuth(
      { id: 42, first_name: 'Alice', auth_date: now },
      BOT_TOKEN,
    );
    expect(result.ok).toBe(false);
  });
});
