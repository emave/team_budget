import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, listOpenChargesForMember } from '@/server/domain/charges';
import { fifoAllocate } from '@/server/domain/payments';
import { generateMonthlyDues } from '@/server/domain/dues';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';

describe('fifoAllocate', () => {
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

  it('allocates fully to one charge', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    expect(await fifoAllocate(db, memberId, 100)).toEqual([
      { chargeId: c.id, amount: 100 },
    ]);
  });

  it('splits across oldest first', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'oldest',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'newer',
      createdByUserId: adminId,
    });
    expect(await fifoAllocate(db, memberId, 150)).toEqual([
      { chargeId: c1.id, amount: 100 },
      { chargeId: c2.id, amount: 50 },
    ]);
  });

  it('returns partial allocation when amount exceeds total debt (excess becomes credit)', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    expect(await fifoAllocate(db, memberId, 150)).toEqual([
      { chargeId: c.id, amount: 100 },
    ]);
  });

  it('with chargeTypes filter, restricts allocation to selected types', async () => {
    await updateMonthlyDuesAmount(db, 1500);
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    const adhoc = await createAdhocCharge(db, {
      userId: memberId,
      amount: 4000,
      description: 'pizza',
      createdByUserId: adminId,
    });
    const open = await listOpenChargesForMember(db, memberId);
    const dues = open.find((c) => c.type === 'monthly_dues')!;

    const duesOnly = await fifoAllocate(db, memberId, 5000, {
      chargeTypes: ['monthly_dues'],
    });
    expect(duesOnly).toEqual([{ chargeId: dues.id, amount: 1500 }]);

    const all = await fifoAllocate(db, memberId, 5000);
    const allChargeIds = all.map((a) => a.chargeId).sort();
    expect(allChargeIds).toEqual([dues.id, adhoc.id].sort());
  });

  it('with chargeTypes filter that matches nothing, returns []', async () => {
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 4000,
      description: 'pizza',
      createdByUserId: adminId,
    });
    expect(
      await fifoAllocate(db, memberId, 5000, { chargeTypes: ['monthly_dues'] }),
    ).toEqual([]);
  });
});
