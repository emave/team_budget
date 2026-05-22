import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { recordPayment } from '@/server/domain/payments';
import { createAdhocCharge } from '@/server/domain/charges';
import {
  getCreditBalance,
  listMemberCreditBalances,
  getTotalCreditLiability,
  recordCreditDeposit,
  applyCreditToCharge,
} from '@/server/domain/credit';
import {
  createPotBorrow,
  getChargeById,
  listOpenChargesForMember,
} from '@/server/domain/charges';
import { generateMonthlyDues } from '@/server/domain/dues';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';

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

describe('recordCreditDeposit', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' })).id;
  });

  it('creates a zero-allocation payment and increases credit', async () => {
    const r = await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 6000,
      createdByUserId: adminId,
    });
    expect(r.payment.amount).toBe(6000);
    expect(r.allocations.length).toBe(0);
    expect(await getCreditBalance(db, memberId)).toBe(6000);
  });

  it('auto-applies to existing open dues charges (FIFO by charge createdAt)', async () => {
    await updateMonthlyDuesAmount(db, 1500);
    await generateMonthlyDues(db, { period: '2026-04', createdByUserId: adminId });
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    const opens = await listOpenChargesForMember(db, memberId);
    expect(opens.length).toBe(2);
    await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 4000,
      createdByUserId: adminId,
    });
    expect((await getChargeById(db, opens[0].id))?.status).toBe('paid');
    expect((await getChargeById(db, opens[1].id))?.status).toBe('paid');
    expect(await getCreditBalance(db, memberId)).toBe(1000);
  });
});

describe('applyCreditToCharge', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' })).id;
  });

  it('applies credit to a pot_borrow charge and marks paid', async () => {
    await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      createdByUserId: adminId,
    });
    const borrow = await createPotBorrow(db, {
      userId: memberId,
      amount: 2500,
      sourcePot: 'cash',
      description: 'b',
      createdByUserId: adminId,
    });
    await applyCreditToCharge(db, {
      chargeId: borrow.id,
      amount: 2500,
      createdByUserId: adminId,
    });
    expect((await getChargeById(db, borrow.id))?.status).toBe('paid');
    expect(await getCreditBalance(db, memberId)).toBe(2500);
  });

  it('rejects when amount exceeds available credit', async () => {
    await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 1000,
      createdByUserId: adminId,
    });
    const borrow = await createPotBorrow(db, {
      userId: memberId,
      amount: 2500,
      sourcePot: 'cash',
      description: 'b',
      createdByUserId: adminId,
    });
    await expect(
      applyCreditToCharge(db, {
        chargeId: borrow.id,
        amount: 2500,
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/insufficient credit/i);
  });

  it('rejects when charge belongs to a different user', async () => {
    const other = await createUser(db, { telegramUserId: 9, displayName: 'X', role: 'member' });
    await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      createdByUserId: adminId,
    });
    const otherBorrow = await createPotBorrow(db, {
      userId: other.id,
      amount: 2500,
      sourcePot: 'cash',
      description: 'b',
      createdByUserId: adminId,
    });
    await expect(
      applyCreditToCharge(db, {
        chargeId: otherBorrow.id,
        amount: 2500,
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/insufficient credit|different member|wallet/i);
  });
});
