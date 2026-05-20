import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import {
  getOrCreateSettings,
  updateMonthlyDuesAmount,
  setLastDuesGeneratedFor,
} from '@/server/domain/settings';

describe('settings', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates defaults on first read', async () => {
    const s = await getOrCreateSettings(db);
    expect(s.monthlyDuesAmount).toBe(0);
    expect(s.dueDay).toBe(1);
    expect(s.lastDuesGeneratedFor).toBeNull();
    expect(s.cashOpeningCents).toBe(0);
    expect(s.cardOpeningCents).toBe(0);
  });

  it('updates monthly dues amount', async () => {
    await getOrCreateSettings(db);
    const updated = await updateMonthlyDuesAmount(db, 5000);
    expect(updated.monthlyDuesAmount).toBe(5000);
  });

  it('records last dues generated for', async () => {
    await getOrCreateSettings(db);
    const updated = await setLastDuesGeneratedFor(db, '2026-05');
    expect(updated.lastDuesGeneratedFor).toBe('2026-05');
  });
});
