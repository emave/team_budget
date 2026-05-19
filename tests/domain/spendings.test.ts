import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { recordSpending, cancelSpending } from '@/server/domain/spendings';

describe('spendings', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
  });

  it('records a spending against a pot', async () => {
    const s = await recordSpending(db, {
      pot: 'cash',
      amount: 800,
      description: 'ammo',
      createdByUserId: adminId,
    });
    expect(s.amount).toBe(800);
    expect(s.pot).toBe('cash');
  });

  it('rejects invalid pot', async () => {
    await expect(
      recordSpending(db, {
        // @ts-expect-error runtime
        pot: 'crypto',
        amount: 100,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects amount <= 0', async () => {
    await expect(
      recordSpending(db, {
        pot: 'cash',
        amount: 0,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('cancelSpending sets cancelledAt', async () => {
    const s = await recordSpending(db, {
      pot: 'cash',
      amount: 800,
      description: 'ammo',
      createdByUserId: adminId,
    });
    const cancelled = await cancelSpending(db, s.id);
    expect(cancelled.cancelledAt).toBeTruthy();
  });
});
