import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { recordPayment, fifoAllocate } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { getTeamOverview } from '@/server/domain/team';

describe('getTeamOverview', () => {
  let db: TestDb;
  let adminId: string;
  let m1Id: string;
  let m2Id: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'Admin', role: 'admin' })).id;
    m1Id = (await createUser(db, { telegramUserId: 2, displayName: 'Alice', role: 'member' })).id;
    m2Id = (await createUser(db, { telegramUserId: 3, displayName: 'Bob', role: 'member' })).id;
  });

  it('reports zero totals on empty team data', async () => {
    const o = await getTeamOverview(db);
    expect(o.totalOutstandingCents).toBe(0);
    expect(o.cashPotCents).toBe(0);
    expect(o.cardPotCents).toBe(0);
    expect(o.members).toHaveLength(3);
    expect(o.settledCount).toBe(3);
    expect(o.unsettledCount).toBe(0);
  });

  it('sums per-member debts and sorts unsettled first', async () => {
    await createAdhocCharge(db, { userId: m1Id, amount: 1000, description: 'a', createdByUserId: adminId });
    await createAdhocCharge(db, { userId: m2Id, amount: 5000, description: 'b', createdByUserId: adminId });
    const o = await getTeamOverview(db);
    expect(o.totalOutstandingCents).toBe(6000);
    expect(o.unsettledCount).toBe(2);
    expect(o.settledCount).toBe(1);
    // sorted by outstanding desc — Bob (5000) before Alice (1000) before Admin (0)
    expect(o.members.map((m) => m.userId)).toEqual([m2Id, m1Id, adminId]);
  });

  it('reflects payments into the cash pot and spendings out of it', async () => {
    const c = await createAdhocCharge(db, { userId: m1Id, amount: 4000, description: 'a', createdByUserId: adminId });
    const allocs = await fifoAllocate(db, m1Id, 4000);
    await recordPayment(db, {
      payerUserId: m1Id,
      method: 'cash',
      amount: 4000,
      allocations: allocs,
      createdByUserId: adminId,
    });
    await recordSpending(db, { pot: 'cash', amount: 1500, description: 'food', createdByUserId: adminId });

    const o = await getTeamOverview(db);
    expect(o.cashPotCents).toBe(4000 - 1500);
    expect(o.cardPotCents).toBe(0);
    expect(o.totalOutstandingCents).toBe(0);
    // Avoid unused-var complaint in case allocations change order
    expect(c.id).toBeTruthy();
  });
});
