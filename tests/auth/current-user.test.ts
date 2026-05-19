import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';
import { resolveCurrentUser } from '@/server/auth/current-user';

const SECRET = 'a'.repeat(32);

describe('resolveCurrentUser', () => {
  let db: TestDb;
  let userId: string;
  let validCookie: string;

  beforeEach(async () => {
    db = createTestDb();
    const u = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Alice',
      role: 'member',
    });
    userId = u.id;
    const s = await createSession(db, userId);
    validCookie = signCookie(s.token, SECRET);
  });

  it('returns the user for a valid cookie', async () => {
    const r = await resolveCurrentUser(db, validCookie, SECRET);
    expect(r?.id).toBe(userId);
  });

  it('returns null for missing cookie', async () => {
    const r = await resolveCurrentUser(db, undefined, SECRET);
    expect(r).toBeNull();
  });

  it('returns null for tampered cookie', async () => {
    const r = await resolveCurrentUser(db, validCookie + 'x', SECRET);
    expect(r).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    const fake = signCookie('not-a-real-token', SECRET);
    const r = await resolveCurrentUser(db, fake, SECRET);
    expect(r).toBeNull();
  });
});
