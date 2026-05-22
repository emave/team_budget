import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createGuest, archiveGuest } from '@/server/domain/guests';
import {
  recordGuestDeposit,
  cancelGuestDeposit,
  listGuestDeposits,
  sumGuestDepositsByMethod,
} from '@/server/domain/guest-deposits';

describe('guest-deposits domain', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
  });

  it('records an anonymous deposit (no guestId)', async () => {
    const d = await recordGuestDeposit(db, {
      amount: 5000,
      method: 'cash',
      createdByUserId: adminId,
    });
    expect(d.amount).toBe(5000);
    expect(d.method).toBe('cash');
    expect(d.guestId).toBeNull();
    expect(d.receivedAt).toBeTruthy();
  });

  it('records a deposit linked to a guest', async () => {
    const g = await createGuest(db, { name: 'Pasha', createdByUserId: adminId });
    const d = await recordGuestDeposit(db, {
      guestId: g.id,
      amount: 3000,
      method: 'card',
      note: 'sat game',
      createdByUserId: adminId,
    });
    expect(d.guestId).toBe(g.id);
    expect(d.note).toBe('sat game');
  });

  it('rejects non-positive amount', async () => {
    await expect(
      recordGuestDeposit(db, { amount: 0, method: 'cash', createdByUserId: adminId }),
    ).rejects.toThrow();
    await expect(
      recordGuestDeposit(db, { amount: -1, method: 'cash', createdByUserId: adminId }),
    ).rejects.toThrow();
  });

  it('rejects unknown guestId', async () => {
    await expect(
      recordGuestDeposit(db, {
        guestId: 'nope',
        amount: 100,
        method: 'cash',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects archived guest', async () => {
    const g = await createGuest(db, { name: 'Old', createdByUserId: adminId });
    await archiveGuest(db, g.id);
    await expect(
      recordGuestDeposit(db, {
        guestId: g.id,
        amount: 100,
        method: 'cash',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('cancel is idempotent and excludes from sums', async () => {
    const d = await recordGuestDeposit(db, { amount: 1000, method: 'cash', createdByUserId: adminId });
    await recordGuestDeposit(db, { amount: 2000, method: 'cash', createdByUserId: adminId });
    expect(await sumGuestDepositsByMethod(db, 'cash')).toBe(3000);
    await cancelGuestDeposit(db, d.id);
    await cancelGuestDeposit(db, d.id); // idempotent
    expect(await sumGuestDepositsByMethod(db, 'cash')).toBe(2000);
  });

  it('list filters by guestId and excludes cancelled when asked', async () => {
    const g = await createGuest(db, { name: 'P', createdByUserId: adminId });
    const a = await recordGuestDeposit(db, { guestId: g.id, amount: 100, method: 'cash', createdByUserId: adminId });
    await recordGuestDeposit(db, { amount: 200, method: 'cash', createdByUserId: adminId });
    await cancelGuestDeposit(db, a.id);
    const all = await listGuestDeposits(db, { includeCancelled: true });
    expect(all.length).toBe(2);
    const onlyGuest = await listGuestDeposits(db, { guestId: g.id, includeCancelled: true });
    expect(onlyGuest.length).toBe(1);
    expect(onlyGuest[0]!.id).toBe(a.id);
  });
});
