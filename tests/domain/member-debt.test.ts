import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createAdhocCharge,
  getMemberOutstandingDebt,
  listOpenChargesForMember,
} from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';

describe('outstanding debt', () => {
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

  it('is 0 with no charges', async () => {
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(0);
  });

  it('sums open charges', async () => {
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 3000,
      description: 'b',
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(8000);
  });

  it('subtracts allocations', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 3000,
      description: 'b',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      allocations: [
        { chargeId: c.id, amount: 2000 },
        { chargeId: c2.id, amount: 3000 },
      ],
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(3000);
  });

  it('excludes cancelled charges', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    const { cancelCharge } = await import('@/server/domain/charges');
    await cancelCharge(db, c.id);
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(0);
  });

  it('lists open charges in FIFO order', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 1000,
      description: 'oldest',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 2000,
      description: 'newer',
      createdByUserId: adminId,
    });
    const list = await listOpenChargesForMember(db, memberId);
    expect(list.map((c) => c.id)).toEqual([c1.id, c2.id]);
  });
});
