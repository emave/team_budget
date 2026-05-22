import { and, asc, eq, isNull, sum } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  charges,
  payments,
  paymentAllocations,
  creditMovements,
  users,
} from '@/server/db/schema';
import type { Db } from './types';
import { recordPayment } from './payments';
import {
  recomputeChargeStatus,
  sumAllocationsForCharge,
  listOpenChargesForMember,
} from './charges';

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

export async function consumeCreditForCharge(db: Db, chargeId: string): Promise<number> {
  const charge = db.select().from(charges).where(eq(charges.id, chargeId)).get();
  if (!charge || charge.status !== 'open') return 0;
  const alreadyAllocated = await sumAllocationsForCharge(db, chargeId);
  let need = charge.amount - alreadyAllocated;
  if (need <= 0) return 0;

  const available = db
    .select({
      id: payments.id,
      amount: payments.amount,
      receivedAt: payments.receivedAt,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(and(eq(payments.payerUserId, charge.userId), isNull(payments.cancelledAt)))
    .orderBy(asc(payments.receivedAt), asc(payments.createdAt), asc(payments.id))
    .all();

  let consumed = 0;
  for (const p of available) {
    if (need <= 0) break;
    const allocRow = db
      .select({ s: sum(paymentAllocations.amount) })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, p.id))
      .get();
    const remaining = p.amount - Number(allocRow?.s ?? 0);
    if (remaining <= 0) continue;
    const take = Math.min(remaining, need);
    db.insert(paymentAllocations)
      .values({ id: randomUUID(), paymentId: p.id, chargeId, amount: take })
      .run();
    need -= take;
    consumed += take;
  }
  if (consumed > 0) await recomputeChargeStatus(db, chargeId);
  return consumed;
}

export interface RecordCreditDepositInput {
  payerUserId: string;
  method: 'cash' | 'card';
  amount: number;
  note?: string;
  receivedAt?: string;
  createdByUserId: string;
}

export async function recordCreditDeposit(db: Db, input: RecordCreditDepositInput) {
  const result = await recordPayment(db, {
    payerUserId: input.payerUserId,
    method: input.method,
    amount: input.amount,
    note: input.note,
    receivedAt: input.receivedAt,
    allocations: [],
    createdByUserId: input.createdByUserId,
  });
  const opens = await listOpenChargesForMember(db, input.payerUserId);
  for (const c of opens) {
    if (c.type !== 'monthly_dues') continue;
    await consumeCreditForCharge(db, c.id);
  }
  return result;
}
