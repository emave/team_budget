import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';
import { generateMonthlyDues } from '@/server/domain/dues';
import {
  createSplitCharge,
  createPotBorrow,
  getMemberOutstandingDebt,
} from '@/server/domain/charges';
import { recordPayment, fifoAllocate } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { getPotBalances } from '@/server/domain/pots';

describe('money flow integration', () => {
  let db: TestDb;
  let adminId: string;
  let vasya: string;
  let petya: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'Admin', role: 'admin' })
    ).id;
    vasya = (
      await createUser(db, {
        telegramUserId: 100,
        displayName: 'Vasya',
        role: 'member',
      })
    ).id;
    petya = (
      await createUser(db, {
        telegramUserId: 101,
        displayName: 'Petya',
        role: 'member',
      })
    ).id;
    await updateMonthlyDuesAmount(db, 5000); // $50
  });

  it('runs the canonical scenario end-to-end', async () => {
    // Step 1: Generate May dues (all 3 active users including admin)
    const r1 = await generateMonthlyDues(db, {
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(r1.createdCount).toBe(3);

    // Step 2: Admin creates an out-of-bounds split: $80 backpacks for vasya and petya
    await createSplitCharge(db, {
      description: 'Tactical backpacks',
      allocations: [
        { userId: vasya, amount: 8000 },
        { userId: petya, amount: 8000 },
      ],
      createdByUserId: adminId,
    });

    // Vasya now owes $50 + $80 = $130
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(13000);

    // Step 3: Vasya pays $50 cash, allocated FIFO (clears May dues)
    const alloc = await fifoAllocate(db, vasya, 5000);
    await recordPayment(db, {
      payerUserId: vasya,
      method: 'cash',
      amount: 5000,
      allocations: alloc,
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(8000);

    // Step 4: Admin spends $30 cash on ammo
    await recordSpending(db, {
      pot: 'cash',
      amount: 3000,
      description: 'Ammo',
      createdByUserId: adminId,
    });

    // Cash pot = $50 in - $30 out = $20
    let pots = await getPotBalances(db);
    expect(pots).toEqual({ cash: 2000, card: 0 });

    // Step 5: Vasya borrows $20 cash from the pot
    await createPotBorrow(db, {
      userId: vasya,
      amount: 2000,
      sourcePot: 'cash',
      description: 'Range fee front',
      createdByUserId: adminId,
    });
    pots = await getPotBalances(db);
    expect(pots).toEqual({ cash: 0, card: 0 });
    // Vasya now owes $80 backpacks + $20 borrow = $100
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(10000);

    // Step 6: Vasya repays the entire $100 via card
    const alloc2 = await fifoAllocate(db, vasya, 10000);
    await recordPayment(db, {
      payerUserId: vasya,
      method: 'card',
      amount: 10000,
      allocations: alloc2,
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(0);

    // Cash pot still 0 (paid back via card); card pot now $100
    pots = await getPotBalances(db);
    expect(pots).toEqual({ cash: 0, card: 10000 });
  });
});
