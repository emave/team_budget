import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createInvite,
  findOpenInviteByToken,
  consumeInvite,
  listPendingInvites,
  revokeInvite,
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

  it('listPendingInvites returns only invites that are neither consumed nor revoked', async () => {
    const pending = await createInvite(db, { createdByUserId: adminId, displayNameHint: 'A' });
    const consumed = await createInvite(db, { createdByUserId: adminId, displayNameHint: 'B' });
    const revoked = await createInvite(db, { createdByUserId: adminId, displayNameHint: 'C' });
    const u = await createUser(db, { telegramUserId: 99, displayName: 'B', role: 'member' });
    await consumeInvite(db, consumed.token, u.id);
    await revokeInvite(db, revoked.id);

    const list = await listPendingInvites(db);
    expect(list.map((i) => i.id)).toEqual([pending.id]);
  });

  it('revokeInvite makes findOpenInviteByToken return undefined', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    await revokeInvite(db, inv.id);
    expect(await findOpenInviteByToken(db, inv.token)).toBeUndefined();
  });

  it('revokeInvite throws on already-consumed invite', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const u = await createUser(db, { telegramUserId: 99, displayName: 'X', role: 'member' });
    await consumeInvite(db, inv.token, u.id);
    await expect(revokeInvite(db, inv.id)).rejects.toThrow(/already consumed/);
  });

  it('revokeInvite is idempotent for already-revoked invites', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const first = await revokeInvite(db, inv.id);
    const second = await revokeInvite(db, inv.id);
    expect(second.revokedAt).toBe(first.revokedAt);
  });
});
