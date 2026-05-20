import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import {
  getOrCreateSettings,
  updateMonthlyDuesAmount,
  setLastDuesGeneratedFor,
  updatePotOpenings,
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

  it('updates pot openings', async () => {
    await getOrCreateSettings(db);
    const updated = await updatePotOpenings(db, 12345, 67890);
    expect(updated.cashOpeningCents).toBe(12345);
    expect(updated.cardOpeningCents).toBe(67890);
  });

  it('rejects negative pot openings', async () => {
    await getOrCreateSettings(db);
    await expect(updatePotOpenings(db, -1, 0)).rejects.toThrow();
    await expect(updatePotOpenings(db, 0, -1)).rejects.toThrow();
  });

  it('rejects non-integer pot openings', async () => {
    await getOrCreateSettings(db);
    await expect(updatePotOpenings(db, 1.5, 0)).rejects.toThrow();
  });
});
