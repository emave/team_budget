import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '../helpers/db';
import * as schema from '@/server/db/schema';
import {
  createUser,
  getUserByTelegramId,
  deactivateUser,
  reactivateUser,
  updateUserProfile,
  canHardDeleteUser,
  hardDeleteUser,
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

  it('canHardDeleteUser returns null for an isolated user', async () => {
    const u = await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'member' });
    expect(await canHardDeleteUser(db, u.id)).toBeNull();
  });

  it('canHardDeleteUser blocks user with a charge', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.charges).values({
      id: 'c1', userId: u.id, type: 'adhoc', amount: 100,
      description: 'd', createdByUserId: admin.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks the charge creator too', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.charges).values({
      id: 'c1', userId: admin.id, type: 'adhoc', amount: 100,
      description: 'd', createdByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks user with a payment', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.payments).values({
      id: 'p1', payerUserId: u.id, method: 'cash', amount: 100,
      receivedAt: '2026-01-01T00:00:00Z', createdByUserId: admin.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks user with a spending', async () => {
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'admin' });
    db.insert(schema.spendings).values({
      id: 's1', pot: 'cash', amount: 100, description: 'd',
      occurredAt: '2026-01-01T00:00:00Z', createdByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser blocks info-page editor', async () => {
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'admin' });
    db.insert(schema.infoPages).values({
      id: 'i1', title: 't', body: 'b', updatedByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_financial_history');
  });

  it('canHardDeleteUser flags invite creator', async () => {
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'admin' });
    db.insert(schema.invites).values({
      id: 'inv1', token: 'tok1', createdByUserId: u.id,
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_invites');
  });

  it('canHardDeleteUser flags invite consumer', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.invites).values({
      id: 'inv1', token: 'tok1', createdByUserId: admin.id,
      consumedByUserId: u.id, consumedAt: '2026-01-01T00:00:00Z',
    }).run();
    expect(await canHardDeleteUser(db, u.id)).toBe('has_invites');
  });

  it('hardDeleteUser removes the user and their sessions', async () => {
    const u = await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'member' });
    db.insert(schema.sessions).values({
      token: 'tok', userId: u.id, expiresAt: '2099-01-01T00:00:00Z',
    }).run();

    await hardDeleteUser(db, u.id);

    expect(db.select().from(schema.users).where(eq(schema.users.id, u.id)).get()).toBeUndefined();
    expect(db.select().from(schema.sessions).where(eq(schema.sessions.userId, u.id)).get())
      .toBeUndefined();
  });

  it('hardDeleteUser refuses when references remain', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'X', role: 'admin' });
    const u = await createUser(db, { telegramUserId: 2, displayName: 'A', role: 'member' });
    db.insert(schema.charges).values({
      id: 'c1', userId: u.id, type: 'adhoc', amount: 100,
      description: 'd', createdByUserId: admin.id,
    }).run();

    await expect(hardDeleteUser(db, u.id)).rejects.toThrow(/cannot delete/i);
  });
});
