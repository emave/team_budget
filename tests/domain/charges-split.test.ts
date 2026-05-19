import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSplitCharge } from '@/server/domain/charges';

describe('createSplitCharge', () => {
  let db: TestDb;
  let adminId: string;
  let members: string[];
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    members = [];
    for (let i = 0; i < 3; i++) {
      members.push(
        (
          await createUser(db, {
            telegramUserId: 100 + i,
            displayName: `M${i}`,
            role: 'member',
          })
        ).id,
      );
    }
  });

  it('creates N charges sharing a group_id', async () => {
    const allocations = members.map((id) => ({ userId: id, amount: 8000 }));
    const result = await createSplitCharge(db, {
      description: 'Tactical backpacks',
      allocations,
      createdByUserId: adminId,
    });
    expect(result.charges.length).toBe(3);
    const groupIds = new Set(result.charges.map((c) => c.groupId));
    expect(groupIds.size).toBe(1);
    for (const c of result.charges) {
      expect(c.type).toBe('out_of_bounds');
      expect(c.amount).toBe(8000);
    }
  });

  it('supports unequal amounts', async () => {
    const result = await createSplitCharge(db, {
      description: 'Field rental',
      allocations: [
        { userId: members[0]!, amount: 5000 },
        { userId: members[1]!, amount: 3000 },
        { userId: members[2]!, amount: 2000 },
      ],
      createdByUserId: adminId,
    });
    expect(result.charges.map((c) => c.amount).sort((a, b) => a - b)).toEqual([
      2000, 3000, 5000,
    ]);
  });

  it('rejects empty allocations', async () => {
    await expect(
      createSplitCharge(db, {
        description: 'x',
        allocations: [],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown member', async () => {
    await expect(
      createSplitCharge(db, {
        description: 'x',
        allocations: [{ userId: 'ghost', amount: 100 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects non-positive per-member amount', async () => {
    await expect(
      createSplitCharge(db, {
        description: 'x',
        allocations: [{ userId: members[0]!, amount: 0 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });
});
