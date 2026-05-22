import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser, deactivateUser } from '@/server/domain/users';
import { getOrCreateSettings, updateMonthlyDuesAmount } from '@/server/domain/settings';
import { chargeMemberDues, MemberAlreadyChargedError, generateMonthlyDues } from '@/server/domain/dues';
import { charges } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

describe('generateMonthlyDues', () => {
  let db: TestDb;
  let adminId: string;
  let memberIds: string[];

  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberIds = [];
    for (let i = 0; i < 3; i++) {
      memberIds.push(
        (
          await createUser(db, {
            telegramUserId: 100 + i,
            displayName: `M${i}`,
            role: 'member',
          })
        ).id,
      );
    }
    await updateMonthlyDuesAmount(db, 5000);
  });

  it('creates one charge per active user for the period', async () => {
    const r = await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    expect(r.createdCount).toBe(4);
    const all = db
      .select()
      .from(charges)
      .where(eq(charges.billingPeriod, '2026-05'))
      .all();
    expect(all.length).toBe(4);
    for (const c of all) expect(c.amount).toBe(5000);
  });

  it('is idempotent — second call creates 0', async () => {
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    const r2 = await generateMonthlyDues(db, {
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(r2.createdCount).toBe(0);
  });

  it('skips inactive users', async () => {
    await deactivateUser(db, memberIds[0]!);
    const r = await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    expect(r.createdCount).toBe(3);
  });

  it('uses the current monthly_dues_amount at generation time', async () => {
    await updateMonthlyDuesAmount(db, 7000);
    await generateMonthlyDues(db, { period: '2026-06', createdByUserId: adminId });
    const all = db
      .select()
      .from(charges)
      .where(eq(charges.billingPeriod, '2026-06'))
      .all();
    for (const c of all) expect(c.amount).toBe(7000);
  });

  it('uses settings.last_dues_generated_for as the idempotency marker', async () => {
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    const r2 = await generateMonthlyDues(db, {
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(r2.createdCount).toBe(0);
  });
});

describe('generateMonthlyDues with existing credit', () => {
  it('auto-consumes credit for each new dues charge', async () => {
    const db = createTestDb();
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const member = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const { recordCreditDeposit, getCreditBalance } = await import('@/server/domain/credit');
    await updateMonthlyDuesAmount(db, 2000);
    await recordCreditDeposit(db, {
      payerUserId: member.id,
      method: 'card',
      amount: 5000,
      createdByUserId: admin.id,
    });
    expect(await getCreditBalance(db, member.id)).toBe(5000);
    await generateMonthlyDues(db, { period: '2026-06', createdByUserId: admin.id });
    expect(await getCreditBalance(db, member.id)).toBe(3000);
  });

  it('leaves dues partially open when credit insufficient', async () => {
    const db = createTestDb();
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const member = await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' });
    const { recordCreditDeposit, getCreditBalance } = await import('@/server/domain/credit');
    await updateMonthlyDuesAmount(db, 2000);
    await recordCreditDeposit(db, {
      payerUserId: member.id,
      method: 'cash',
      amount: 500,
      createdByUserId: admin.id,
    });
    await generateMonthlyDues(db, { period: '2026-06', createdByUserId: admin.id });
    expect(await getCreditBalance(db, member.id)).toBe(0);
  });
});

describe('chargeMemberDues', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' })).id;
    await updateMonthlyDuesAmount(db, 5000);
  });

  it('creates a monthly_dues charge for the user and period at current settings amount', async () => {
    const c = await chargeMemberDues(db, {
      userId: memberId,
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(c.type).toBe('monthly_dues');
    expect(c.userId).toBe(memberId);
    expect(c.billingPeriod).toBe('2026-05');
    expect(c.amount).toBe(5000);
    expect(c.status).toBe('open');
  });

  it('rejects invalid period format', async () => {
    await expect(
      chargeMemberDues(db, { userId: memberId, period: '2026-5', createdByUserId: adminId }),
    ).rejects.toThrow(/invalid period/);
    await expect(
      chargeMemberDues(db, { userId: memberId, period: 'foo', createdByUserId: adminId }),
    ).rejects.toThrow(/invalid period/);
  });

  it('rejects when monthly dues amount is not set', async () => {
    await updateMonthlyDuesAmount(db, 0);
    await expect(
      chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
    ).rejects.toThrow(/monthly_dues_amount must be set/);
  });

  it('rejects when user does not exist', async () => {
    await expect(
      chargeMemberDues(db, {
        userId: '00000000-0000-0000-0000-000000000000',
        period: '2026-05',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/not found/);
  });

  it('rejects when user is inactive', async () => {
    await deactivateUser(db, memberId);
    await expect(
      chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
    ).rejects.toThrow(/not active/);
  });

  it('throws MemberAlreadyChargedError when an OPEN charge for the same period exists', async () => {
    await chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId });
    await expect(
      chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
    ).rejects.toBeInstanceOf(MemberAlreadyChargedError);
  });

  it('throws MemberAlreadyChargedError when a PAID charge for the same period exists', async () => {
    const c = await chargeMemberDues(db, {
      userId: memberId,
      period: '2026-05',
      createdByUserId: adminId,
    });
    db.update(charges).set({ status: 'paid' }).where(eq(charges.id, c.id)).run();
    await expect(
      chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
    ).rejects.toBeInstanceOf(MemberAlreadyChargedError);
  });

  it('throws MemberAlreadyChargedError when a CANCELLED charge for the same period exists', async () => {
    const c = await chargeMemberDues(db, {
      userId: memberId,
      period: '2026-05',
      createdByUserId: adminId,
    });
    db.update(charges).set({ status: 'cancelled' }).where(eq(charges.id, c.id)).run();
    await expect(
      chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
    ).rejects.toBeInstanceOf(MemberAlreadyChargedError);
  });

  it('does not modify settings.lastDuesGeneratedFor', async () => {
    const before = (await getOrCreateSettings(db)).lastDuesGeneratedFor;
    await chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId });
    const after = (await getOrCreateSettings(db)).lastDuesGeneratedFor;
    expect(after).toBe(before);
  });

  it('auto-consumes wallet credit when sufficient (charge is paid)', async () => {
    const { recordCreditDeposit } = await import('@/server/domain/credit');
    await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      createdByUserId: adminId,
    });

    const c = await chargeMemberDues(db, {
      userId: memberId,
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(c.status).toBe('paid');
  });
});
