import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';

const cookieRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieRef.value } : undefined) }),
}));

import { makeSpendingActions } from '@/server/actions/spendings';

const SECRET = 'a'.repeat(32);

describe('spending actions', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    const s = await createSession(db, adminId);
    cookieRef.value = signCookie(s.token, SECRET);
  });

  it('records a spending', async () => {
    const a = makeSpendingActions({ getDb: () => db });
    const s = await a.recordSpending({ pot: 'cash', amount: 800, description: 'ammo' });
    expect(s.pot).toBe('cash');
    expect(s.amount).toBe(800);
  });

  it('cancels a spending', async () => {
    const a = makeSpendingActions({ getDb: () => db });
    const s = await a.recordSpending({ pot: 'cash', amount: 800, description: 'ammo' });
    const c = await a.cancelSpending({ id: s.id });
    expect(c.cancelledAt).toBeTruthy();
  });
});
