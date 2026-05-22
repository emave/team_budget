import { and, eq, isNull, sum } from 'drizzle-orm';
import {
  payments,
  paymentAllocations,
  creditMovements,
  users,
} from '@/server/db/schema';
import type { Db } from './types';

export async function getCreditBalance(db: Db, userId: string): Promise<number> {
  const paymentRows = db
    .select({ id: payments.id, amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.payerUserId, userId), isNull(payments.cancelledAt)))
    .all();
  let fromPayments = 0;
  for (const p of paymentRows) {
    const row = db
      .select({ s: sum(paymentAllocations.amount) })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, p.id))
      .get();
    fromPayments += p.amount - Number(row?.s ?? 0);
  }
  const movs = db
    .select({ kind: creditMovements.kind, amount: creditMovements.amount })
    .from(creditMovements)
    .where(and(eq(creditMovements.userId, userId), isNull(creditMovements.cancelledAt)))
    .all();
  let fromMovements = 0;
  for (const m of movs) {
    if (m.kind === 'transfer_in') fromMovements += m.amount;
    else fromMovements -= m.amount;
  }
  return fromPayments + fromMovements;
}

export async function listMemberCreditBalances(
  db: Db,
): Promise<{ userId: string; balance: number }[]> {
  const all = db.select({ id: users.id }).from(users).all();
  const out: { userId: string; balance: number }[] = [];
  for (const u of all) {
    const b = await getCreditBalance(db, u.id);
    if (b !== 0) out.push({ userId: u.id, balance: b });
  }
  return out;
}

export async function getTotalCreditLiability(db: Db): Promise<number> {
  const actives = db.select({ id: users.id }).from(users).where(eq(users.isActive, true)).all();
  let total = 0;
  for (const u of actives) total += await getCreditBalance(db, u.id);
  return total;
}
