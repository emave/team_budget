import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { recordPayment } from '@/server/domain/payments';
import { createAdhocCharge } from '@/server/domain/charges';
import {
  getCreditBalance,
  listMemberCreditBalances,
  getTotalCreditLiability,
} from '@/server/domain/credit';

describe('credit balance reads', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  let otherId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' })).id;
    otherId = (await createUser(db, { telegramUserId: 3, displayName: 'O', role: 'member' })).id;
  });

  it('returns 0 when member has no payments', async () => {
    expect(await getCreditBalance(db, memberId)).toBe(0);
  });

  it('returns unallocated remainder of a payment', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 3000,
      description: 'x',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      allocations: [{ chargeId: c.id, amount: 3000 }],
      createdByUserId: adminId,
    });
    expect(await getCreditBalance(db, memberId)).toBe(2000);
  });

  it('returns full amount for a zero-allocation payment', async () => {
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'card',
      amount: 4000,
      allocations: [],
      createdByUserId: adminId,
    });
    expect(await getCreditBalance(db, memberId)).toBe(4000);
  });

  it('listMemberCreditBalances includes only members with non-zero balance', async () => {
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 2500,
      allocations: [],
      createdByUserId: adminId,
    });
    const rows = await listMemberCreditBalances(db);
    const m = rows.find((r) => r.userId === memberId);
    expect(m?.balance).toBe(2500);
    expect(rows.find((r) => r.userId === otherId)).toBeUndefined();
  });

  it('getTotalCreditLiability sums active members only', async () => {
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 2500,
      allocations: [],
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: otherId,
      method: 'card',
      amount: 1500,
      allocations: [],
      createdByUserId: adminId,
    });
    expect(await getTotalCreditLiability(db)).toBe(4000);
  });
});
