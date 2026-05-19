import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';
import { runMonthlyDuesOnce } from '@/server/jobs/monthly-dues';
import { charges } from '@/server/db/schema';

describe('runMonthlyDuesOnce', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    await updateMonthlyDuesAmount(db, 5000);
  });

  it('uses currentBillingPeriod and createdBy=admin user', async () => {
    const result = await runMonthlyDuesOnce(db, { now: new Date('2026-05-15T00:00:00Z') });
    expect(result.period).toBe('2026-05');
    const rows = db.select().from(charges).all();
    expect(rows.length).toBe(1);
    expect(rows[0]?.createdByUserId).toBe(adminId);
  });

  it('throws if no admin exists', async () => {
    const db2 = createTestDb();
    await updateMonthlyDuesAmount(db2, 5000);
    await expect(
      runMonthlyDuesOnce(db2, { now: new Date('2026-05-15T00:00:00Z') }),
    ).rejects.toThrow(/no admin/i);
  });
});
