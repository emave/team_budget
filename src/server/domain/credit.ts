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
    .select({ amount: creditMovements.amount })
    .from(creditMovements)
    .where(and(eq(creditMovements.userId, userId), isNull(creditMovements.cancelledAt)))
    .all();
  const fromMovements = movs.reduce((s, m) => s - m.amount, 0);
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

export interface ApplyCreditInput {
  chargeId: string;
  amount: number;
  createdByUserId: string;
}

export async function applyCreditToCharge(db: Db, input: ApplyCreditInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error(`amount must be positive integer, got ${input.amount}`);
  }
  const charge = db.select().from(charges).where(eq(charges.id, input.chargeId)).get();
  if (!charge) throw new Error(`charge ${input.chargeId} not found`);
  if (charge.status !== 'open') throw new Error(`charge ${input.chargeId} is not open`);
  const balance = await getCreditBalance(db, charge.userId);
  if (balance < input.amount) {
    throw new Error(
      `insufficient credit on owner's wallet: have ${balance}, need ${input.amount}`,
    );
  }
  const remaining = charge.amount - (await sumAllocationsForCharge(db, input.chargeId));
  if (input.amount > remaining) {
    throw new Error(`amount ${input.amount} exceeds charge remaining ${remaining}`);
  }
  const consumed = await consumeCreditForChargeAmount(db, input.chargeId, input.amount);
  if (consumed !== input.amount) {
    throw new Error(`credit application incomplete: consumed ${consumed} of ${input.amount}`);
  }
}

export interface RefundCreditInput {
  userId: string;
  amount: number;
  method: 'cash' | 'card';
  note?: string;
  occurredAt?: string;
  createdByUserId: string;
}

export async function refundCredit(db: Db, input: RefundCreditInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error(`amount must be positive integer, got ${input.amount}`);
  }
  if (input.method !== 'cash' && input.method !== 'card') {
    throw new Error(`invalid method: ${String(input.method)}`);
  }
  const balance = await getCreditBalance(db, input.userId);
  if (balance < input.amount) {
    throw new Error(`insufficient credit: have ${balance}, need ${input.amount}`);
  }
  const id = randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  db.insert(creditMovements)
    .values({
      id,
      userId: input.userId,
      kind: 'refund',
      amount: input.amount,
      method: input.method,
      counterpartyUserId: null,
      groupId: null,
      note: input.note ?? null,
      occurredAt,
      createdByUserId: input.createdByUserId,
    })
    .run();
  return db.select().from(creditMovements).where(eq(creditMovements.id, id)).get()!;
}

export interface TransferCreditInput {
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
  occurredAt?: string;
  createdByUserId: string;
}

export async function transferCredit(db: Db, input: TransferCreditInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error(`amount must be positive integer, got ${input.amount}`);
  }
  if (input.fromUserId === input.toUserId) {
    throw new Error('cannot transfer to the same member');
  }
  const fromBalance = await getCreditBalance(db, input.fromUserId);
  if (fromBalance < input.amount) {
    throw new Error(`insufficient credit: have ${fromBalance}, need ${input.amount}`);
  }
  const groupId = randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const destPaymentId = randomUUID();
  db.transaction((tx) => {
    tx.insert(creditMovements)
      .values({
        id: randomUUID(),
        userId: input.fromUserId,
        kind: 'transfer_out',
        amount: input.amount,
        method: null,
        counterpartyUserId: input.toUserId,
        groupId,
        note: input.note ?? null,
        occurredAt,
        createdByUserId: input.createdByUserId,
      })
      .run();
    tx.insert(payments)
      .values({
        id: destPaymentId,
        payerUserId: input.toUserId,
        method: 'cash',
        amount: input.amount,
        note: input.note ?? null,
        receivedAt: occurredAt,
        createdByUserId: input.createdByUserId,
        excludeFromPot: true,
        transferredFromUserId: input.fromUserId,
        transferGroupId: groupId,
      })
      .run();
  });
  const destOpens = await listOpenChargesForMember(db, input.toUserId);
  for (const c of destOpens) {
    if (c.type !== 'monthly_dues') continue;
    await consumeCreditForCharge(db, c.id);
  }
  return { groupId, destPaymentId };
}

export async function cancelCreditMovement(db: Db, id: string) {
  const row = db.select().from(creditMovements).where(eq(creditMovements.id, id)).get();
  if (!row) throw new Error(`credit movement ${id} not found`);
  if (row.cancelledAt) return row;

  const now = new Date().toISOString();
  // For a transfer_out, also cancel the paired destination payment (excludeFromPot row).
  let pairedPaymentId: string | null = null;
  if (row.kind === 'transfer_out' && row.groupId) {
    const paired = db
      .select({ id: payments.id, cancelledAt: payments.cancelledAt })
      .from(payments)
      .where(eq(payments.transferGroupId, row.groupId))
      .get();
    pairedPaymentId = paired?.id ?? null;
  }

  db.transaction((tx) => {
    tx.update(creditMovements)
      .set({ cancelledAt: now })
      .where(eq(creditMovements.id, id))
      .run();
    if (pairedPaymentId) {
      tx.update(payments)
        .set({ cancelledAt: now })
        .where(and(eq(payments.id, pairedPaymentId), isNull(payments.cancelledAt)))
        .run();
    }
  });

  const touchedUsers = new Set<string>([row.userId]);
  if (row.counterpartyUserId) touchedUsers.add(row.counterpartyUserId);
  for (const userId of touchedUsers) {
    const balance = await getCreditBalance(db, userId);
    if (balance < 0) {
      // Roll back
      db.transaction((tx) => {
        tx.update(creditMovements)
          .set({ cancelledAt: null })
          .where(eq(creditMovements.id, id))
          .run();
        if (pairedPaymentId) {
          tx.update(payments)
            .set({ cancelledAt: null })
            .where(eq(payments.id, pairedPaymentId))
            .run();
        }
      });
      throw new Error(`cancellation would push member ${userId} credit below zero`);
    }
  }
  return db.select().from(creditMovements).where(eq(creditMovements.id, id)).get()!;
}

async function consumeCreditForChargeAmount(
  db: Db,
  chargeId: string,
  amount: number,
): Promise<number> {
  const charge = db.select().from(charges).where(eq(charges.id, chargeId)).get();
  if (!charge) return 0;
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
  let need = amount;
  let consumed = 0;
  for (const p of available) {
    if (need <= 0) break;
    const allocRow = db
      .select({ s: sum(paymentAllocations.amount) })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, p.id))
      .get();
    const rem = p.amount - Number(allocRow?.s ?? 0);
    if (rem <= 0) continue;
    const take = Math.min(rem, need);
    db.insert(paymentAllocations)
      .values({ id: randomUUID(), paymentId: p.id, chargeId, amount: take })
      .run();
    need -= take;
    consumed += take;
  }
  if (consumed > 0) await recomputeChargeStatus(db, chargeId);
  return consumed;
}
