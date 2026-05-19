import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser, deactivateUser } from '@/server/domain/users';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';
import { generateMonthlyDues } from '@/server/domain/dues';
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
