import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createSession,
  getSession,
  refreshSession,
  deleteSession,
} from '@/server/domain/sessions';

describe('sessions domain', () => {
  let db: TestDb;
  let userId: string;
  beforeEach(async () => {
    db = createTestDb();
    const u = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Alice',
      role: 'admin',
    });
    userId = u.id;
  });

  it('creates a session with a token and expiry ~30d', async () => {
    const s = await createSession(db, userId);
    expect(s.token).toMatch(/^[a-f0-9]{64}$/);
    const ms = new Date(s.expiresAt).getTime() - Date.now();
    expect(ms).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('looks up an active session', async () => {
    const created = await createSession(db, userId);
    const found = await getSession(db, created.token);
    expect(found?.userId).toBe(userId);
  });

  it('returns undefined for expired session', async () => {
    const s = await createSession(db, userId, { ttlMs: -1000 });
    const found = await getSession(db, s.token);
    expect(found).toBeUndefined();
  });

  it('refreshes a session, extending expiry', async () => {
    const s = await createSession(db, userId, { ttlMs: 60_000 });
    const refreshed = await refreshSession(db, s.token);
    expect(new Date(refreshed!.expiresAt).getTime()).toBeGreaterThan(
      new Date(s.expiresAt).getTime(),
    );
  });

  it('deletes a session', async () => {
    const s = await createSession(db, userId);
    await deleteSession(db, s.token);
    expect(await getSession(db, s.token)).toBeUndefined();
  });
});
