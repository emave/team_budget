import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash?: string;
}

export type VerifyResult =
  | { ok: true; data: Omit<TelegramAuthData, 'hash'> & { hash: string } }
  | { ok: false; reason: string };

const MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day

export function verifyTelegramAuth(input: TelegramAuthData, botToken: string): VerifyResult {
  const { hash, ...rest } = input;
  if (!hash) return { ok: false, reason: 'missing hash' };

  const age = Math.floor(Date.now() / 1000) - input.auth_date;
  if (age > MAX_AGE_SECONDS) return { ok: false, reason: 'auth_date too old' };

  const secret = createHash('sha256').update(botToken).digest();
  const dataCheck = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const expected = createHmac('sha256', secret).update(dataCheck).digest();
  const got = Buffer.from(hash, 'hex');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true, data: { ...input, hash } };
}
