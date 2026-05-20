import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';

const cookieRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieRef.value } : undefined) }),
}));

import { makeChargeActions } from '@/server/actions/charges';

const SECRET = 'a'.repeat(32);

describe('charge actions', () => {
  let db: TestDb;
  let adminId: string;
  let memberA: string;
  let memberB: string;

  beforeEach(async () => {
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    process.env.SKIP_BOT = '1';
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberA = (await createUser(db, { telegramUserId: 2, displayName: 'A1', role: 'member' })).id;
    memberB = (await createUser(db, { telegramUserId: 3, displayName: 'B1', role: 'member' })).id;
    const s = await createSession(db, adminId);
    cookieRef.value = signCookie(s.token, SECRET);
  });

  it('createAdhocCharge', async () => {
    const a = makeChargeActions({ getDb: () => db });
    const c = await a.createAdhocCharge({ userId: memberA, amount: 5000, description: 'gear' });
    expect(c.type).toBe('adhoc');
    expect(c.amount).toBe(5000);
  });

  it('createSplitCharge', async () => {
    const a = makeChargeActions({ getDb: () => db });
    const r = await a.createSplitCharge({
      description: 'Backpacks',
      allocations: [
        { userId: memberA, amount: 8000 },
        { userId: memberB, amount: 8000 },
      ],
    });
    expect(r.charges.length).toBe(2);
  });

  it('createPotBorrow', async () => {
    const a = makeChargeActions({ getDb: () => db });
    const c = await a.createPotBorrow({ userId: memberA, amount: 2000, sourcePot: 'cash', description: 'gas' });
    expect(c.sourcePot).toBe('cash');
  });

  it('cancelCharge', async () => {
    const a = makeChargeActions({ getDb: () => db });
    const c = await a.createAdhocCharge({ userId: memberA, amount: 100, description: 'x' });
    const cancelled = await a.cancelCharge({ id: c.id });
    expect(cancelled.status).toBe('cancelled');
  });

  it('parses amount from string', async () => {
    const a = makeChargeActions({ getDb: () => db });
    const c = await a.createAdhocCharge({ userId: memberA, amount: '50.00' as unknown as number, description: 'x' });
    expect(c.amount).toBe(5000);
  });
});
