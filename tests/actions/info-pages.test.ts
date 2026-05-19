import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';

const cookieRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieRef.value } : undefined) }),
}));

import { makeInfoPageActions } from '@/server/actions/info-pages';

const SECRET = 'a'.repeat(32);

describe('info page actions', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    const s = await createSession(db, adminId);
    cookieRef.value = signCookie(s.token, SECRET);
  });

  it('upsert creates then updates', async () => {
    const a = makeInfoPageActions({ getDb: () => db });
    const p1 = await a.upsertInfoPage({ title: 'Card details', body: 'Send to 1234' });
    expect(p1.title).toBe('Card details');
    const p2 = await a.upsertInfoPage({ id: p1.id, title: 'Card details v2', body: 'Send to 5678' });
    expect(p2.title).toBe('Card details v2');
    expect(p2.body).toBe('Send to 5678');
  });

  it('reorder', async () => {
    const a = makeInfoPageActions({ getDb: () => db });
    const x = await a.upsertInfoPage({ title: 'X', body: '' });
    const y = await a.upsertInfoPage({ title: 'Y', body: '' });
    await a.reorderInfoPages({ orderedIds: [y.id, x.id] });
    const list = await a.listInfoPages({});
    expect(list.map((p: { id: string }) => p.id)).toEqual([y.id, x.id]);
  });

  it('delete', async () => {
    const a = makeInfoPageActions({ getDb: () => db });
    const p = await a.upsertInfoPage({ title: 'X', body: '' });
    await a.deleteInfoPage({ id: p.id });
    expect((await a.listInfoPages({})).length).toBe(0);
  });
});
