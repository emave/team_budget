import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { listMoneyMovements } from '@/server/domain/movements';
import { payments, spendings } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

describe('listMoneyMovements', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  let memberId2: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })).id;
    memberId2 = (await createUser(db, { telegramUserId: 3, displayName: 'B', role: 'member' })).id;
  });

  it('returns deposits and withdrawals merged and sorted desc by business date', async () => {
    const c1 = await createAdhocCharge(db, { userId: memberId, amount: 500, description: 'gear', createdByUserId: adminId });
    await recordPayment(db, {
      payerUserId: memberId, method: 'cash', amount: 500,
      receivedAt: '2026-05-10T10:00:00.000Z',
      allocations: [{ chargeId: c1.id, amount: 500 }],
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'card', amount: 200, description: 'field fee',
      occurredAt: '2026-05-12T10:00:00.000Z',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, { userId: memberId2, amount: 300, description: 'g2', createdByUserId: adminId });
    await recordPayment(db, {
      payerUserId: memberId2, method: 'card', amount: 300,
      receivedAt: '2026-05-11T10:00:00.000Z',
      allocations: [{ chargeId: c2.id, amount: 300 }],
      createdByUserId: adminId,
    });

    const rows = await listMoneyMovements(db, { from: '2026-05-01', to: '2026-05-31' });
    expect(rows.map((r) => r.kind)).toEqual(['withdraw', 'deposit', 'deposit']);
    expect(rows[0]).toMatchObject({ kind: 'withdraw', pot: 'card', amount: 200, description: 'field fee' });
    expect(rows[1]).toMatchObject({ kind: 'deposit', payerDisplayName: 'B', amount: 300, method: 'card' });
    expect(rows[2]).toMatchObject({ kind: 'deposit', payerDisplayName: 'V', amount: 500, method: 'cash' });
  });

  it('excludes rows outside the range (inclusive on both ends, with end-of-day on `to`)', async () => {
    const c = await createAdhocCharge(db, { userId: memberId, amount: 100, description: 'x', createdByUserId: adminId });
    await recordPayment(db, {
      payerUserId: memberId, method: 'cash', amount: 100,
      receivedAt: '2026-05-31T23:30:00.000Z',
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'cash', amount: 50, description: 'before',
      occurredAt: '2026-04-30T23:30:00.000Z',
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'cash', amount: 70, description: 'after',
      occurredAt: '2026-06-01T00:30:00.000Z',
      createdByUserId: adminId,
    });
    const rows = await listMoneyMovements(db, { from: '2026-05-01', to: '2026-05-31' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'deposit', amount: 100 });
  });

  it('excludes cancelled payments and spendings', async () => {
    const c = await createAdhocCharge(db, { userId: memberId, amount: 100, description: 'x', createdByUserId: adminId });
    const paid = await recordPayment(db, {
      payerUserId: memberId, method: 'cash', amount: 100,
      receivedAt: '2026-05-10T10:00:00.000Z',
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    const sp = await recordSpending(db, {
      pot: 'cash', amount: 50, description: 'ammo',
      occurredAt: '2026-05-11T10:00:00.000Z',
      createdByUserId: adminId,
    });
    db.update(payments).set({ cancelledAt: '2026-05-15T10:00:00.000Z' }).where(eq(payments.id, paid.payment.id)).run();
    db.update(spendings).set({ cancelledAt: '2026-05-15T10:00:00.000Z' }).where(eq(spendings.id, sp.id)).run();

    const rows = await listMoneyMovements(db, { from: '2026-05-01', to: '2026-05-31' });
    expect(rows).toEqual([]);
  });

  it('returns empty array when no rows in range', async () => {
    const rows = await listMoneyMovements(db, { from: '2026-01-01', to: '2026-01-31' });
    expect(rows).toEqual([]);
  });

  it('includes guest_deposit events (named and anonymous)', async () => {
    const { createGuest } = await import('@/server/domain/guests');
    const { recordGuestDeposit, cancelGuestDeposit } = await import('@/server/domain/guest-deposits');
    const g = await createGuest(db, { name: 'Pasha', createdByUserId: adminId });
    await recordGuestDeposit(db, {
      guestId: g.id, amount: 4000, method: 'cash',
      receivedAt: '2026-05-15T10:00:00.000Z', note: 'sat game', createdByUserId: adminId,
    });
    await recordGuestDeposit(db, {
      amount: 2000, method: 'card',
      receivedAt: '2026-05-15T11:00:00.000Z', createdByUserId: adminId,
    });
    const cancelled = await recordGuestDeposit(db, {
      amount: 999, method: 'cash',
      receivedAt: '2026-05-15T12:00:00.000Z', createdByUserId: adminId,
    });
    await cancelGuestDeposit(db, cancelled.id);

    const events = await listMoneyMovements(db, { from: '2026-05-15', to: '2026-05-15' });
    const guests = events.filter((e) => e.kind === 'guest_deposit');
    expect(guests.length).toBe(2);
    const named = guests.find((e) => e.kind === 'guest_deposit' && e.guestId === g.id);
    const anon = guests.find((e) => e.kind === 'guest_deposit' && e.guestId === null);
    expect(named && named.kind === 'guest_deposit' && named.guestName).toBe('Pasha');
    expect(anon && anon.kind === 'guest_deposit' && anon.guestName).toBe(null);
  });
});
