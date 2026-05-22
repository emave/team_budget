import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createAdhocCharge,
  getMemberOutstandingDebt,
  getMemberSubscriptionDebt,
  listOpenChargesForMember,
} from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { generateMonthlyDues } from '@/server/domain/dues';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';

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

describe('subscription debt', () => {
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

  it('is 0 when member has no monthly_dues charges', async () => {
    expect(await getMemberSubscriptionDebt(db, memberId)).toBe(0);
  });

  it('excludes non-dues charges', async () => {
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'snacks',
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(5000);
    expect(await getMemberSubscriptionDebt(db, memberId)).toBe(0);
  });

  it('sums open monthly_dues less allocations', async () => {
    await updateMonthlyDuesAmount(db, 1500);
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    expect(await getMemberSubscriptionDebt(db, memberId)).toBe(1500);

    const open = await listOpenChargesForMember(db, memberId);
    const duesCharge = open.find((c) => c.type === 'monthly_dues')!;
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 500,
      allocations: [{ chargeId: duesCharge.id, amount: 500 }],
      createdByUserId: adminId,
    });
    expect(await getMemberSubscriptionDebt(db, memberId)).toBe(1000);
  });

  it('combines dues and adhoc correctly', async () => {
    await updateMonthlyDuesAmount(db, 1500);
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 4000,
      description: 'pizza',
      createdByUserId: adminId,
    });
    expect(await getMemberSubscriptionDebt(db, memberId)).toBe(1500);
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(5500);
  });
});
