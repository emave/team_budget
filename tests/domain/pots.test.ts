import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, createPotBorrow } from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { getPotBalances } from '@/server/domain/pots';

describe('pots', () => {
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

  it('is zero for empty db', async () => {
    expect(await getPotBalances(db)).toEqual({ cash: 0, card: 0 });
  });

  it('counts payments by method', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 300,
      description: 'b',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c1.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'card',
      amount: 300,
      allocations: [{ chargeId: c2.id, amount: 300 }],
      createdByUserId: adminId,
    });
    expect(await getPotBalances(db)).toEqual({ cash: 100, card: 300 });
  });

  it('subtracts spendings by pot', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 500,
      description: 'a',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 500,
      allocations: [{ chargeId: c.id, amount: 500 }],
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'cash',
      amount: 200,
      description: 'ammo',
      createdByUserId: adminId,
    });
    expect(await getPotBalances(db)).toEqual({ cash: 300, card: 0 });
  });

  it('subtracts pot_borrow from source pot regardless of paid status', async () => {
    await createPotBorrow(db, {
      userId: memberId,
      amount: 50,
      sourcePot: 'cash',
      description: 'gas',
      createdByUserId: adminId,
    });
    expect(await getPotBalances(db)).toEqual({ cash: -50, card: 0 });
  });

  it('ignores cancelled payments and cancelled spendings', async () => {
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
    const s = await recordSpending(db, {
      pot: 'cash',
      amount: 30,
      description: 'x',
      createdByUserId: adminId,
    });
    const { cancelPayment } = await import('@/server/domain/payments');
    const { cancelSpending } = await import('@/server/domain/spendings');
    await cancelPayment(db, payment.id);
    await cancelSpending(db, s.id);
    expect(await getPotBalances(db)).toEqual({ cash: 0, card: 0 });
  });
});
