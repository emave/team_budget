import { describe, it, expect } from 'vitest';
import { signCookie, verifyCookie } from '@/server/auth/session-cookie';

const SECRET = 'a'.repeat(32);

describe('session cookie signing', () => {
  it('round-trips a token', () => {
    const signed = signCookie('token123', SECRET);
    const verified = verifyCookie(signed, SECRET);
    expect(verified).toBe('token123');
  });

  it('rejects a tampered cookie', () => {
    const signed = signCookie('token123', SECRET);
    const tampered = signed.replace('token123', 'token456');
    expect(verifyCookie(tampered, SECRET)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyCookie('not.a.cookie', SECRET)).toBeNull();
  });
});
