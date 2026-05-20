import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';

const cookieRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieRef.value } : undefined) }),
}));

import { makeMemberActions } from '@/server/actions/members';

const SECRET = 'a'.repeat(32);

describe('member actions', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'Owner', role: 'admin' })).id;
    const s = await createSession(db, adminId);
    cookieRef.value = signCookie(s.token, SECRET);
  });

  it('admin can create an invite', async () => {
    const actions = makeMemberActions({ getDb: () => db });
    const r = await actions.inviteMember({ displayNameHint: 'Vasya' });
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
  });

  it('admin can create an invite with empty display-name hint', async () => {
    const actions = makeMemberActions({ getDb: () => db });
    const r = await actions.inviteMember({ displayNameHint: '' });
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(r.displayNameHint).toBeNull();
  });

  it('admin can deactivate/reactivate', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const actions = makeMemberActions({ getDb: () => db });
    await actions.deactivateMember({ id: m.id });
    await actions.reactivateMember({ id: m.id });
  });

  it('admin can change role', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const actions = makeMemberActions({ getDb: () => db });
    const r = await actions.changeMemberRole({ id: m.id, role: 'admin' });
    expect(r.role).toBe('admin');
  });

  it('member cannot invite', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const s = await createSession(db, m.id);
    cookieRef.value = signCookie(s.token, SECRET);
    const actions = makeMemberActions({ getDb: () => db });
    await expect(actions.inviteMember({})).rejects.toThrow(/admin required/);
  });

  it('admin can revoke an invite', async () => {
    const actions = makeMemberActions({ getDb: () => db });
    const inv = await actions.inviteMember({ displayNameHint: 'Vasya' });
    const revoked = await actions.revokeInvite({ id: inv.id });
    expect(revoked.revokedAt).toBeTruthy();
  });

  it('member cannot revoke an invite', async () => {
    const adminActions = makeMemberActions({ getDb: () => db });
    const inv = await adminActions.inviteMember({});

    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const s = await createSession(db, m.id);
    cookieRef.value = signCookie(s.token, SECRET);
    const memberActions = makeMemberActions({ getDb: () => db });
    await expect(memberActions.revokeInvite({ id: inv.id })).rejects.toThrow(/admin required/);
  });
});
