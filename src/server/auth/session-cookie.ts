import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signCookie(token: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(token).digest('hex');
  return `${token}.${sig}`;
}

export function verifyCookie(value: string, secret: string): string | null {
  const idx = value.lastIndexOf('.');
  if (idx <= 0) return null;
  const token = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(token).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return token;
}
