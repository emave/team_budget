import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, getChargeById, cancelCharge } from '@/server/domain/charges';
import { recordPayment, cancelPayment } from '@/server/domain/payments';

describe('cancellations', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberId = (
      await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })
    ).id;
  });

  it('cancels a charge with no allocations', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    await cancelCharge(db, c.id);
    expect((await getChargeById(db, c.id))?.status).toBe('cancelled');
  });

  it('refuses to cancel a charge with allocations', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await expect(cancelCharge(db, c.id)).rejects.toThrow(/has allocations/i);
  });

  it('cancelling a payment reopens previously-paid charge', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    const { payment } = await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    expect((await getChargeById(db, c.id))?.status).toBe('paid');
    await cancelPayment(db, payment.id);
    expect((await getChargeById(db, c.id))?.status).toBe('open');
  });

  it('cancelling an already-cancelled payment is a no-op', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    const { payment } = await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await cancelPayment(db, payment.id);
    await cancelPayment(db, payment.id); // does not throw
  });
});
