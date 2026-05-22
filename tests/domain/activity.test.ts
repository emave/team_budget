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

  it('includes guest_deposit events with name resolution', async () => {
    const { createGuest } = await import('@/server/domain/guests');
    const { recordGuestDeposit } = await import('@/server/domain/guest-deposits');
    const g = await createGuest(db, { name: 'Pasha', createdByUserId: adminId });
    await recordGuestDeposit(db, { guestId: g.id, amount: 100, method: 'cash', createdByUserId: adminId });
    await recordGuestDeposit(db, { amount: 200, method: 'card', createdByUserId: adminId });
    const events = await recentActivity(db, 10);
    const guests = events.filter((e) => e.kind === 'guest_deposit');
    expect(guests.length).toBe(2);
    const named = guests.find((e) => e.kind === 'guest_deposit' && e.guestId === g.id);
    const anon = guests.find((e) => e.kind === 'guest_deposit' && e.guestId === null);
    expect(named && named.kind === 'guest_deposit' && named.guestName).toBe('Pasha');
    expect(anon && anon.kind === 'guest_deposit' && anon.guestName).toBe(null);
  });

  it('includes credit_refund events', async () => {
    const { recordCreditDeposit, refundCredit } = await import('@/server/domain/credit');
    await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      createdByUserId: adminId,
    });
    await refundCredit(db, {
      userId: memberId,
      amount: 2000,
      method: 'cash',
      createdByUserId: adminId,
    });
    const events = await recentActivity(db, 10);
    expect(events.some((e) => e.kind === 'credit_refund')).toBe(true);
  });

  it('includes credit_transfer events', async () => {
    const { recordCreditDeposit, transferCredit } = await import('@/server/domain/credit');
    const b = await createUser(db, { telegramUserId: 3, displayName: 'B', role: 'member' });
    await recordCreditDeposit(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      createdByUserId: adminId,
    });
    await transferCredit(db, {
      fromUserId: memberId,
      toUserId: b.id,
      amount: 2000,
      createdByUserId: adminId,
    });
    const events = await recentActivity(db, 10);
    expect(events.some((e) => e.kind === 'credit_transfer')).toBe(true);
  });
});
