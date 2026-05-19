import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createInvite,
  findOpenInviteByToken,
  consumeInvite,
} from '@/server/domain/invites';

describe('invites', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    db = createTestDb();
    const a = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Admin',
      role: 'admin',
    });
    adminId = a.id;
  });

  it('creates an invite with a url-safe token', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId, displayNameHint: 'Vasya' });
    expect(inv.token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(inv.consumedByUserId).toBeNull();
  });

  it('finds an open invite by token', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const found = await findOpenInviteByToken(db, inv.token);
    expect(found?.id).toBe(inv.id);
  });

  it('returns undefined for already-consumed invite', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const newUser = await createUser(db, {
      telegramUserId: 99,
      displayName: 'Vasya',
      role: 'member',
    });
    await consumeInvite(db, inv.token, newUser.id);
    const found = await findOpenInviteByToken(db, inv.token);
    expect(found).toBeUndefined();
  });

  it('consume marks the invite consumed and sets consumed_at', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const newUser = await createUser(db, {
      telegramUserId: 99,
      displayName: 'Vasya',
      role: 'member',
    });
    const consumed = await consumeInvite(db, inv.token, newUser.id);
    expect(consumed.consumedByUserId).toBe(newUser.id);
    expect(consumed.consumedAt).toBeTruthy();
  });

  it('consuming twice throws', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const u1 = await createUser(db, {
      telegramUserId: 99,
      displayName: 'A',
      role: 'member',
    });
    const u2 = await createUser(db, {
      telegramUserId: 100,
      displayName: 'B',
      role: 'member',
    });
    await consumeInvite(db, inv.token, u1.id);
    await expect(consumeInvite(db, inv.token, u2.id)).rejects.toThrow();
  });
});
