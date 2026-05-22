import { and, desc, eq, isNull, sum } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { charges, payments, paymentAllocations, users } from '@/server/db/schema';
import type { Db } from './types';
import { recomputeChargeStatus, sumAllocationsForCharge, listOpenChargesForMember } from './charges';

export type Pot = 'cash' | 'card';

export interface AllocationInput {
  chargeId: string;
  amount: number;
}

export interface RecordPaymentInput {
  payerUserId: string;
  method: Pot;
  amount: number;
  note?: string;
  receivedAt?: string;
  allocations: AllocationInput[];
  createdByUserId: string;
}

export interface RecordPaymentResult {
  payment: typeof payments.$inferSelect;
  allocations: (typeof paymentAllocations.$inferSelect)[];
}

function assertPositive(n: number, label: string) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a positive integer, got ${n}`);
  }
}

export async function recordPayment(
  db: Db,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  assertPositive(input.amount, 'payment amount');
  if (input.method !== 'cash' && input.method !== 'card') {
    throw new Error(`invalid method: ${String(input.method)}`);
  }
  const sumAlloc = input.allocations.reduce((s, a) => s + a.amount, 0);
  if (sumAlloc > input.amount) {
    throw new Error(
      `allocations exceed payment amount: sum(allocations)=${sumAlloc} > amount=${input.amount}`,
    );
  }
  for (const a of input.allocations) assertPositive(a.amount, 'allocation amount');

  const payer = db.select().from(users).where(eq(users.id, input.payerUserId)).get();
  if (!payer) throw new Error(`payer ${input.payerUserId} not found`);

  for (const a of input.allocations) {
    const c = db.select().from(charges).where(eq(charges.id, a.chargeId)).get();
    if (!c) throw new Error(`charge ${a.chargeId} not found`);
    if (c.userId !== input.payerUserId) {
      throw new Error(`charge ${a.chargeId} belongs to a different member`);
    }
    if (c.status === 'cancelled') {
      throw new Error(`charge ${a.chargeId} is cancelled`);
    }
    const alreadyAllocated = await sumAllocationsForCharge(db, a.chargeId);
    if (alreadyAllocated + a.amount > c.amount) {
      throw new Error(
        `allocation ${a.amount} on charge ${a.chargeId} exceeds charge (already ${alreadyAllocated}/${c.amount})`,
      );
    }
  }

  const paymentId = randomUUID();
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(payments)
      .values({
        id: paymentId,
        payerUserId: input.payerUserId,
        method: input.method,
        amount: input.amount,
        note: input.note ?? null,
        receivedAt,
        createdByUserId: input.createdByUserId,
      })
      .run();
    for (const a of input.allocations) {
      tx.insert(paymentAllocations)
        .values({
          id: randomUUID(),
          paymentId,
          chargeId: a.chargeId,
          amount: a.amount,
        })
        .run();
    }
  });

  for (const a of input.allocations) {
    await recomputeChargeStatus(db, a.chargeId);
  }

  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get()!;
  const allocs = db
    .select()
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .all();
  return { payment, allocations: allocs };
}

export async function listPaymentsByPayer(db: Db, payerUserId: string) {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.payerUserId, payerUserId), isNull(payments.cancelledAt)))
    .all();
}

export async function fifoAllocate(
  db: Db,
  payerUserId: string,
  amount: number,
): Promise<AllocationInput[]> {
  let remaining = amount;
  const result: AllocationInput[] = [];
  const open = await listOpenChargesForMember(db, payerUserId);
  for (const c of open) {
    if (remaining <= 0) break;
    const already = await sumAllocationsForCharge(db, c.id);
    const headroom = c.amount - already;
    if (headroom <= 0) continue;
    const take = Math.min(headroom, remaining);
    result.push({ chargeId: c.id, amount: take });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error(
      `payment amount ${amount} exceeds total open debt by ${remaining}`,
    );
  }
  return result;
}

export async function cancelPayment(db: Db, paymentId: string) {
  const p = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!p) throw new Error(`payment ${paymentId} not found`);
  if (p.cancelledAt) return p; // idempotent

  const affectedCharges = db
    .select({ chargeId: paymentAllocations.chargeId })
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .all();

  db.update(payments)
    .set({ cancelledAt: new Date().toISOString() })
    .where(eq(payments.id, paymentId))
    .run();

  for (const { chargeId } of affectedCharges) {
    await recomputeChargeStatus(db, chargeId);
  }
  return db.select().from(payments).where(eq(payments.id, paymentId)).get()!;
}

export async function listAllPayments(db: Db, limit = 200) {
  return db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).all();
}

export async function sumUnallocatedForPayment(db: Db, paymentId: string): Promise<number> {
  const p = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!p || p.cancelledAt) return 0;
  const row = db
    .select({ s: sum(paymentAllocations.amount) })
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .get();
  return p.amount - Number(row?.s ?? 0);
}
