import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createGuest } from '@/server/domain/guests';
import { recordCreditDeposit } from '@/server/domain/credit';
import { recordGuestDeposit, cancelGuestDeposit } from '@/server/domain/guest-deposits';
import { recordPayment } from '@/server/domain/payments';
import { createAdhocCharge } from '@/server/domain/charges';
import { listDeposits } from '@/server/domain/deposits';

describe('deposits domain', () => {
  let db: TestDb;
  let adminId: string;
  let alice: string;
  let bob: string;
  let guestId: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'Admin', role: 'admin' })).id;
    alice = (await createUser(db, { telegramUserId: 2, displayName: 'Alice', role: 'member' })).id;
    bob = (await createUser(db, { telegramUserId: 3, displayName: 'Bob', role: 'member' })).id;
    guestId = (await createGuest(db, { name: 'Guest1', createdByUserId: adminId })).id;
  });

  it('returns wallet deposits and guest deposits in a unified shape', async () => {
    await recordCreditDeposit(db, {
      payerUserId: alice,
      method: 'cash',
      amount: 1000,
      createdByUserId: adminId,
      receivedAt: '2026-05-20T10:00:00.000Z',
    });
    await recordGuestDeposit(db, {
      guestId,
      amount: 500,
      method: 'card',
      createdByUserId: adminId,
      receivedAt: '2026-05-21T10:00:00.000Z',
    });

    const rows = await listDeposits(db, {});
    expect(rows.length).toBe(2);
    expect(rows[0]!.source).toBe('guest');
    expect(rows[0]!.amount).toBe(500);
    expect(rows[1]!.source).toBe('member');
    expect(rows[1]!.personName).toBe('Alice');
  });

  it('excludes charge_payment rows (payments allocated to a non-dues charge)', async () => {
    const charge = await createAdhocCharge(db, {
      userId: bob,
      amount: 1500,
      description: 'Field rental',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: bob,
      method: 'cash',
      amount: 1500,
      allocations: [{ chargeId: charge.id, amount: 1500 }],
      createdByUserId: adminId,
    });

    const rows = await listDeposits(db, { source: 'member' });
    expect(rows.length).toBe(0);
  });

  it('filters by source, person, and date range and ignores cancelled rows', async () => {
    await recordCreditDeposit(db, {
      payerUserId: alice,
      method: 'cash',
      amount: 100,
      createdByUserId: adminId,
      receivedAt: '2026-05-10T10:00:00.000Z',
    });
    await recordCreditDeposit(db, {
      payerUserId: bob,
      method: 'cash',
      amount: 200,
      createdByUserId: adminId,
      receivedAt: '2026-05-15T10:00:00.000Z',
    });
    const guestDep = await recordGuestDeposit(db, {
      guestId,
      amount: 300,
      method: 'cash',
      createdByUserId: adminId,
      receivedAt: '2026-05-15T10:00:00.000Z',
    });
    const cancelledDep = await recordGuestDeposit(db, {
      guestId,
      amount: 9999,
      method: 'cash',
      createdByUserId: adminId,
      receivedAt: '2026-05-15T11:00:00.000Z',
    });
    await cancelGuestDeposit(db, cancelledDep.id);

    const all = await listDeposits(db, { range: { from: '2026-05-14', to: '2026-05-16' } });
    expect(all.length).toBe(2);
    expect(all.some((r) => r.id === cancelledDep.id)).toBe(false);
    expect(all.some((r) => r.id === guestDep.id)).toBe(true);

    const onlyMembers = await listDeposits(db, { source: 'member' });
    expect(onlyMembers.length).toBe(2);
    expect(onlyMembers.every((r) => r.source === 'member')).toBe(true);

    const onlyAlice = await listDeposits(db, { source: 'member', personId: alice });
    expect(onlyAlice.length).toBe(1);
    expect(onlyAlice[0]!.personName).toBe('Alice');

    const onlyGuest = await listDeposits(db, { source: 'guest', personId: guestId });
    expect(onlyGuest.length).toBe(1);
    expect(onlyGuest[0]!.id).toBe(guestDep.id);

    const allByPerson = await listDeposits(db, { personId: alice });
    expect(allByPerson.length).toBe(1);
    expect(allByPerson[0]!.source).toBe('member');
  });
});
