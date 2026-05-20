import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';

const cookieRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieRef.value } : undefined) }),
}));

import { makeSettingsActions } from '@/server/actions/settings';
import { makeCategoryActions } from '@/server/actions/categories';

const SECRET = 'a'.repeat(32);

describe('settings + categories actions', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    process.env.SKIP_BOT = '1';
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    const s = await createSession(db, adminId);
    cookieRef.value = signCookie(s.token, SECRET);
  });

  it('updates monthly dues amount', async () => {
    const s = makeSettingsActions({ getDb: () => db });
    const r = await s.updateMonthlyDuesAmount({ amount: 5000 });
    expect(r.monthlyDuesAmount).toBe(5000);
  });

  it('runs dues now', async () => {
    const s = makeSettingsActions({ getDb: () => db });
    await s.updateMonthlyDuesAmount({ amount: 5000 });
    const r = await s.runDuesNow({});
    expect(r.createdCount).toBeGreaterThan(0);
  });

  it('categories CRUD', async () => {
    const c = makeCategoryActions({ getDb: () => db });
    const created = await c.upsertCategory({ name: 'Ammo' });
    expect(created.name).toBe('Ammo');
    const renamed = await c.upsertCategory({ id: created.id, name: 'Ammunition' });
    expect(renamed.name).toBe('Ammunition');
    await c.archiveCategory({ id: created.id });
    expect((await c.listCategories({})).length).toBe(0);
  });
});
