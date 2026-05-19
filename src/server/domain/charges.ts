import { and, eq, isNull, sum } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { charges, payments, paymentAllocations, users } from '@/server/db/schema';
import type { Db } from './types';
import { statusForCharge } from './charge-status';

export type Charge = typeof charges.$inferSelect;

async function assertUserExists(db: Db, userId: string) {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) throw new Error(`user ${userId} not found`);
}

export async function getChargeById(db: Db, id: string) {
  return db.select().from(charges).where(eq(charges.id, id)).get();
}

function assertPositive(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`amount must be a positive integer, got ${amount}`);
  }
}

export interface CreateAdhocChargeInput {
  userId: string;
  amount: number;
  description: string;
  createdByUserId: string;
}

export async function createAdhocCharge(db: Db, input: CreateAdhocChargeInput): Promise<Charge> {
  assertPositive(input.amount);
  await assertUserExists(db, input.userId);
  await assertUserExists(db, input.createdByUserId);
  const id = randomUUID();
  db.insert(charges)
    .values({
      id,
      userId: input.userId,
      type: 'adhoc',
      amount: input.amount,
      description: input.description,
      status: 'open',
      createdByUserId: input.createdByUserId,
    })
    .run();
  return (await getChargeById(db, id))!;
}

export async function sumAllocationsForCharge(db: Db, chargeId: string): Promise<number> {
  const row = db
    .select({ s: sum(paymentAllocations.amount) })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(and(eq(paymentAllocations.chargeId, chargeId), isNull(payments.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}

export async function recomputeChargeStatus(db: Db, chargeId: string) {
  const charge = await getChargeById(db, chargeId);
  if (!charge) throw new Error('charge missing');
  if (charge.status === 'cancelled') return;
  const allocated = await sumAllocationsForCharge(db, chargeId);
  const next = statusForCharge({
    amount: charge.amount,
    allocated,
    cancelled: false,
  });
  if (next !== charge.status) {
    db.update(charges).set({ status: next }).where(eq(charges.id, chargeId)).run();
  }
}

export type Pot = 'cash' | 'card';

export interface CreatePotBorrowInput {
  userId: string;
  amount: number;
  sourcePot: Pot;
  description: string;
  createdByUserId: string;
}

export async function createPotBorrow(db: Db, input: CreatePotBorrowInput): Promise<Charge> {
  assertPositive(input.amount);
  if (input.sourcePot !== 'cash' && input.sourcePot !== 'card') {
    throw new Error(`invalid source pot: ${String(input.sourcePot)}`);
  }
  await assertUserExists(db, input.userId);
  await assertUserExists(db, input.createdByUserId);
  const id = randomUUID();
  db.insert(charges)
    .values({
      id,
      userId: input.userId,
      type: 'pot_borrow',
      amount: input.amount,
      description: input.description,
      sourcePot: input.sourcePot,
      status: 'open',
      createdByUserId: input.createdByUserId,
    })
    .run();
  return (await getChargeById(db, id))!;
}
