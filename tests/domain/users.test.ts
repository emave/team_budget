import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import {
  createUser,
  getUserByTelegramId,
  deactivateUser,
  reactivateUser,
  updateUserProfile,
} from '@/server/domain/users';

describe('users domain', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a member user', async () => {
    const u = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    expect(u.id).toBeDefined();
    expect(u.role).toBe('member');
    expect(u.isActive).toBe(true);
  });

  it('looks up by telegram id', async () => {
    await createUser(db, { telegramUserId: 42, displayName: 'Alice', role: 'member' });
    const u = await getUserByTelegramId(db, 42);
    expect(u?.displayName).toBe('Alice');
  });

  it('returns undefined for unknown telegram id', async () => {
    const u = await getUserByTelegramId(db, 999);
    expect(u).toBeUndefined();
  });

  it('deactivates and reactivates a user', async () => {
    const created = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    const off = await deactivateUser(db, created.id);
    expect(off.isActive).toBe(false);
    expect(off.deactivatedAt).toBeTruthy();
    const on = await reactivateUser(db, created.id);
    expect(on.isActive).toBe(true);
    expect(on.deactivatedAt).toBeNull();
  });

  it('updates display name and role together', async () => {
    const u = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    const updated = await updateUserProfile(db, u.id, {
      displayName: 'Alice II',
      role: 'admin',
    });
    expect(updated.displayName).toBe('Alice II');
    expect(updated.role).toBe('admin');
  });

  it('updateUserProfile throws when user is missing', async () => {
    await expect(
      updateUserProfile(db, '00000000-0000-0000-0000-000000000000', {
        displayName: 'Ghost',
        role: 'member',
      }),
    ).rejects.toThrow(/user not found/);
  });

  it('rejects duplicate telegram id', async () => {
    await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'member' });
    await expect(
      createUser(db, { telegramUserId: 42, displayName: 'B', role: 'member' }),
    ).rejects.toThrow();
  });
});
