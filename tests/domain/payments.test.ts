import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, getChargeById } from '@/server/domain/charges';
import { recordPayment, listPaymentsByPayer } from '@/server/domain/payments';

describe('recordPayment', () => {
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

  it('records a fully-allocated payment against one charge', async () => {
    const charge = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'gear',
      createdByUserId: adminId,
    });
    const p = await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      allocations: [{ chargeId: charge.id, amount: 5000 }],
      createdByUserId: adminId,
    });
    expect(p.payment.method).toBe('cash');
    expect(p.allocations.length).toBe(1);
    expect((await getChargeById(db, charge.id))?.status).toBe('paid');
  });

  it('allocates across multiple charges', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 3000,
      description: 'a',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 7000,
      description: 'b',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'card',
      amount: 10000,
      allocations: [
        { chargeId: c1.id, amount: 3000 },
        { chargeId: c2.id, amount: 7000 },
      ],
      createdByUserId: adminId,
    });
    expect((await getChargeById(db, c1.id))?.status).toBe('paid');
    expect((await getChargeById(db, c2.id))?.status).toBe('paid');
  });

  it('rejects payment that does not fully allocate', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await expect(
      recordPayment(db, {
        payerUserId: memberId,
        method: 'cash',
        amount: 5000,
        allocations: [{ chargeId: c.id, amount: 4000 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/fully allocate/i);
  });

  it('rejects overallocating a single charge', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await expect(
      recordPayment(db, {
        payerUserId: memberId,
        method: 'cash',
        amount: 6000,
        allocations: [{ chargeId: c.id, amount: 6000 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/exceeds charge/i);
  });

  it('rejects allocation to another member’s charge', async () => {
    const other = await createUser(db, {
      telegramUserId: 3,
      displayName: 'O',
      role: 'member',
    });
    const c = await createAdhocCharge(db, {
      userId: other.id,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await expect(
      recordPayment(db, {
        payerUserId: memberId,
        method: 'cash',
        amount: 5000,
        allocations: [{ chargeId: c.id, amount: 5000 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/different member/i);
  });

  it('lists payments for payer', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      allocations: [{ chargeId: c.id, amount: 5000 }],
      createdByUserId: adminId,
    });
    const list = await listPaymentsByPayer(db, memberId);
    expect(list.length).toBe(1);
  });
});
