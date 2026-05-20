import { eq } from 'drizzle-orm';
import { settings } from '@/server/db/schema';
import type { Db } from './types';

export async function getOrCreateSettings(db: Db) {
  let row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) {
    db.insert(settings)
      .values({ id: 1, monthlyDuesAmount: 0, dueDay: 1 })
      .run();
    row = db.select().from(settings).where(eq(settings.id, 1)).get();
  }
  return row!;
}

export async function updateMonthlyDuesAmount(db: Db, amount: number) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`amount must be a non-negative integer`);
  }
  await getOrCreateSettings(db);
  db.update(settings).set({ monthlyDuesAmount: amount }).where(eq(settings.id, 1)).run();
  return (await getOrCreateSettings(db))!;
}

export async function setLastDuesGeneratedFor(db: Db, period: string | null) {
  await getOrCreateSettings(db);
  db.update(settings)
    .set({ lastDuesGeneratedFor: period })
    .where(eq(settings.id, 1))
    .run();
  return (await getOrCreateSettings(db))!;
}

export async function updatePotOpenings(db: Db, cashCents: number, cardCents: number) {
  if (!Number.isInteger(cashCents) || cashCents < 0) {
    throw new Error(`cashCents must be a non-negative integer`);
  }
  if (!Number.isInteger(cardCents) || cardCents < 0) {
    throw new Error(`cardCents must be a non-negative integer`);
  }
  await getOrCreateSettings(db);
  db.update(settings)
    .set({ cashOpeningCents: cashCents, cardOpeningCents: cardCents })
    .where(eq(settings.id, 1))
    .run();
  return (await getOrCreateSettings(db))!;
}
