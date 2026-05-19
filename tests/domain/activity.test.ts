import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { recentActivity } from '@/server/domain/activity';

describe('recentActivity', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })).id;
  });

  it('returns latest events across charges, payments, spendings', async () => {
    const c = await createAdhocCharge(db, { userId: memberId, amount: 500, description: 'gear', createdByUserId: adminId });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 500,
      allocations: [{ chargeId: c.id, amount: 500 }],
      createdByUserId: adminId,
    });
    await recordSpending(db, { pot: 'cash', amount: 100, description: 'ammo', createdByUserId: adminId });

    const events = await recentActivity(db, 10);
    expect(events.length).toBe(3);
    expect(events[0]?.kind).toBe('spending');
  });

  it('respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await createAdhocCharge(db, { userId: memberId, amount: 100 + i, description: `c${i}`, createdByUserId: adminId });
    }
    const events = await recentActivity(db, 3);
    expect(events.length).toBe(3);
  });
});
