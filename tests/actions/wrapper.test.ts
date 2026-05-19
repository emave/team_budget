import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';

const cookieValueRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieValueRef.value } : undefined) }),
}));

import { makeAdminAction, makeMemberAction, ActionError } from '@/server/actions/_wrapper';

const SECRET = 'a'.repeat(32);

describe('action wrappers', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    const s = await createSession(db, adminId);
    cookieValueRef.value = signCookie(s.token, SECRET);
  });

  it('adminAction executes the body for admin', async () => {
    const adminAction = makeAdminAction({ getDb: () => db });
    const action = adminAction(async ({ user }) => ({ ok: true, userId: user.id }));
    const r = await action(null as never);
    expect(r).toEqual({ ok: true, userId: adminId });
  });

  it('adminAction rejects member', async () => {
    const m = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const s = await createSession(db, m.id);
    cookieValueRef.value = signCookie(s.token, SECRET);
    const adminAction = makeAdminAction({ getDb: () => db });
    const action = adminAction(async () => ({ ok: true }));
    await expect(action(null as never)).rejects.toBeInstanceOf(ActionError);
  });

  it('memberAction rejects when not authenticated', async () => {
    cookieValueRef.value = '';
    const memberAction = makeMemberAction({ getDb: () => db });
    const action = memberAction(async () => ({ ok: true }));
    await expect(action(null as never)).rejects.toBeInstanceOf(ActionError);
  });
});
