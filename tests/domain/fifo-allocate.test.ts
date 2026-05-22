import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { fifoAllocate } from '@/server/domain/payments';

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
});
