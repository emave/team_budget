import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { spendings, users, categories } from '@/server/db/schema';
import type { Db } from './types';

export type Pot = 'cash' | 'card';

export interface RecordSpendingInput {
  pot: Pot;
  amount: number;
  categoryId?: string | null;
  description: string;
  occurredAt?: string;
  createdByUserId: string;
}

export async function recordSpending(db: Db, input: RecordSpendingInput) {
  if (input.pot !== 'cash' && input.pot !== 'card') {
    throw new Error(`invalid pot: ${String(input.pot)}`);
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error(`spending amount must be a positive integer, got ${input.amount}`);
  }
  if (!db.select().from(users).where(eq(users.id, input.createdByUserId)).get()) {
    throw new Error('creator not found');
  }
  if (input.categoryId) {
    if (!db.select().from(categories).where(eq(categories.id, input.categoryId)).get()) {
      throw new Error('category not found');
    }
  }
  const id = randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  db.insert(spendings)
    .values({
      id,
      pot: input.pot,
      amount: input.amount,
      categoryId: input.categoryId ?? null,
      description: input.description,
      occurredAt,
      createdByUserId: input.createdByUserId,
    })
    .run();
  return db.select().from(spendings).where(eq(spendings.id, id)).get()!;
}

export async function cancelSpending(db: Db, id: string) {
  const s = db.select().from(spendings).where(eq(spendings.id, id)).get();
  if (!s) throw new Error('spending not found');
  if (s.cancelledAt) return s;
  db.update(spendings)
    .set({ cancelledAt: new Date().toISOString() })
    .where(eq(spendings.id, id))
    .run();
  return db.select().from(spendings).where(eq(spendings.id, id)).get()!;
}

export async function listSpendings(db: Db) {
  return db.select().from(spendings).all();
}
