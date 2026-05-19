import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { getUserByTelegramId, createUser } from '@/server/domain/users';

describe('bootstrap admin', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates the admin on first call', async () => {
    const result = await bootstrapAdminIfNeeded(db, {
      telegramUserId: 100,
      displayName: 'Owner',
    });
    expect(result.created).toBe(true);
    const u = await getUserByTelegramId(db, 100);
    expect(u?.role).toBe('admin');
  });

  it('is a no-op if the user already exists', async () => {
    await createUser(db, { telegramUserId: 100, displayName: 'Owner', role: 'member' });
    const result = await bootstrapAdminIfNeeded(db, {
      telegramUserId: 100,
      displayName: 'Owner',
    });
    expect(result.created).toBe(false);
    const u = await getUserByTelegramId(db, 100);
    expect(u?.role).toBe('member'); // unchanged
  });

  it('is a no-op if any admin already exists', async () => {
    await createUser(db, { telegramUserId: 200, displayName: 'OtherAdmin', role: 'admin' });
    const result = await bootstrapAdminIfNeeded(db, {
      telegramUserId: 100,
      displayName: 'Owner',
    });
    expect(result.created).toBe(false);
    expect(await getUserByTelegramId(db, 100)).toBeUndefined();
  });
});
