import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, getChargeById } from '@/server/domain/charges';

describe('createAdhocCharge', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    const a = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Admin',
      role: 'admin',
    });
    adminId = a.id;
    const m = await createUser(db, {
      telegramUserId: 2,
      displayName: 'Vasya',
      role: 'member',
    });
    memberId = m.id;
  });

  it('creates a charge with amount in cents', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'Owed for gear rental',
      createdByUserId: adminId,
    });
    expect(c.type).toBe('adhoc');
    expect(c.amount).toBe(5000);
    expect(c.status).toBe('open');
  });

  it('rejects amount <= 0', async () => {
    await expect(
      createAdhocCharge(db, {
        userId: memberId,
        amount: 0,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown user', async () => {
    await expect(
      createAdhocCharge(db, {
        userId: 'nonexistent',
        amount: 100,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('roundtrips via getChargeById', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'Owed for gear rental',
      createdByUserId: adminId,
    });
    const fetched = await getChargeById(db, c.id);
    expect(fetched?.amount).toBe(5000);
  });
});
