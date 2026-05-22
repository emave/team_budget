import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';
import { createAdhocCharge } from '@/server/domain/charges';

const cookieRef = { value: '' };
vi.mock('next/headers', () => ({
  cookies: () => ({ get: (n: string) => (n === 'tb_session' ? { value: cookieRef.value } : undefined) }),
}));

import { makePaymentActions } from '@/server/actions/payments';

const SECRET = 'a'.repeat(32);

describe('payment actions', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;

  beforeEach(async () => {
    db = createTestDb();
    process.env.SESSION_SECRET = SECRET;
    process.env.SKIP_BOT = '1';
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })).id;
    const s = await createSession(db, adminId);
    cookieRef.value = signCookie(s.token, SECRET);
  });

  it('records a payment via action', async () => {
    const c = await createAdhocCharge(db, { userId: memberId, amount: 500, description: 'x', createdByUserId: adminId });
    const a = makePaymentActions({ getDb: () => db });
    const r = await a.recordPayment({
      payerUserId: memberId,
      method: 'cash',
      amount: 500,
      allocations: [{ chargeId: c.id, amount: 500 }],
    });
    expect(r.payment.method).toBe('cash');
  });

  it('listOpenChargesForPayer returns open charges with remaining amounts', async () => {
    const c1 = await createAdhocCharge(db, { userId: memberId, amount: 100, description: 'a', createdByUserId: adminId });
    const c2 = await createAdhocCharge(db, { userId: memberId, amount: 100, description: 'b', createdByUserId: adminId });
    const a = makePaymentActions({ getDb: () => db });
    await a.recordPayment({
      payerUserId: memberId,
      method: 'cash',
      amount: 40,
      allocations: [{ chargeId: c1.id, amount: 40 }],
    });
    const r = await a.listOpenChargesForPayer({ payerUserId: memberId });
    expect(r.map((c) => ({ id: c.id, remaining: c.remainingCents }))).toEqual([
      { id: c1.id, remaining: 60 },
      { id: c2.id, remaining: 100 },
    ]);
  });

  it('cancelPayment reopens charge', async () => {
    const c = await createAdhocCharge(db, { userId: memberId, amount: 100, description: 'x', createdByUserId: adminId });
    const a = makePaymentActions({ getDb: () => db });
    const r = await a.recordPayment({
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
    });
    await a.cancelPayment({ id: r.payment.id });
    const { getChargeById } = await import('@/server/domain/charges');
    expect((await getChargeById(db, c.id))?.status).toBe('open');
  });
});
