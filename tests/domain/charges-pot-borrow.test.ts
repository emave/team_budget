import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createPotBorrow } from '@/server/domain/charges';

describe('createPotBorrow', () => {
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

  it('creates a pot_borrow charge with source_pot=cash', async () => {
    const c = await createPotBorrow(db, {
      userId: memberId,
      amount: 5000,
      sourcePot: 'cash',
      description: 'Borrowed for gas',
      createdByUserId: adminId,
    });
    expect(c.type).toBe('pot_borrow');
    expect(c.sourcePot).toBe('cash');
    expect(c.amount).toBe(5000);
  });

  it('rejects unknown source pot', async () => {
    await expect(
      createPotBorrow(db, {
        userId: memberId,
        amount: 100,
        // @ts-expect-error testing runtime guard
        sourcePot: 'crypto',
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects amount <= 0', async () => {
    await expect(
      createPotBorrow(db, {
        userId: memberId,
        amount: 0,
        sourcePot: 'card',
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });
});
