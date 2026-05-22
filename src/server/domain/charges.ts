import { and, asc, desc, eq, isNull, sum } from 'drizzle-orm';
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

export async function cancelCharge(db: Db, chargeId: string): Promise<Charge> {
  const c = await getChargeById(db, chargeId);
  if (!c) throw new Error(`charge ${chargeId} not found`);
  if (c.status === 'cancelled') return c;
  const allocated = await sumAllocationsForCharge(db, chargeId);
  if (allocated > 0 && c.type !== 'monthly_dues') {
    throw new Error(
      `cannot cancel charge ${chargeId}: it has allocations (cancel the payments first)`,
    );
  }
  db.transaction((tx) => {
    if (allocated > 0) {
      tx.delete(paymentAllocations).where(eq(paymentAllocations.chargeId, chargeId)).run();
    }
    tx.update(charges).set({ status: 'cancelled' }).where(eq(charges.id, chargeId)).run();
  });
  return (await getChargeById(db, chargeId))!;
}

export async function listOpenChargesForMember(db: Db, userId: string) {
  return db
    .select()
    .from(charges)
    .where(and(eq(charges.userId, userId), eq(charges.status, 'open')))
    .orderBy(asc(charges.createdAt))
    .all();
}

export interface ChargesFilter {
  userId?: string;
  type?: 'monthly_dues' | 'out_of_bounds' | 'adhoc' | 'pot_borrow';
  status?: 'open' | 'paid' | 'cancelled';
  limit?: number;
}

export async function listChargesFiltered(db: Db, filter: ChargesFilter = {}) {
  const conds = [];
  if (filter.userId) conds.push(eq(charges.userId, filter.userId));
  if (filter.type) conds.push(eq(charges.type, filter.type));
  if (filter.status) conds.push(eq(charges.status, filter.status));
  const whereExpr = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
  const limit = filter.limit ?? 1000;
  if (whereExpr) {
    return db
      .select()
      .from(charges)
      .where(whereExpr)
      .orderBy(desc(charges.createdAt))
      .limit(limit)
      .all();
  }
  return db.select().from(charges).orderBy(desc(charges.createdAt)).limit(limit).all();
}

export async function getMemberOutstandingDebt(db: Db, userId: string): Promise<number> {
  const open = await listOpenChargesForMember(db, userId);
  let total = 0;
  for (const c of open) {
    const allocated = await sumAllocationsForCharge(db, c.id);
    total += c.amount - allocated;
  }
  return total;
}

export async function getMemberSubscriptionDebt(db: Db, userId: string): Promise<number> {
  const open = await listOpenChargesForMember(db, userId);
  let total = 0;
  for (const c of open) {
    if (c.type !== 'monthly_dues') continue;
    const allocated = await sumAllocationsForCharge(db, c.id);
    total += c.amount - allocated;
  }
  return total;
}

export interface SplitAllocation {
  userId: string;
  amount: number;
}

export interface CreateSplitChargeInput {
  description: string;
  allocations: SplitAllocation[];
  createdByUserId: string;
}

export interface SplitChargeResult {
  groupId: string;
  charges: Charge[];
}

export async function createSplitCharge(
  db: Db,
  input: CreateSplitChargeInput,
): Promise<SplitChargeResult> {
  if (input.allocations.length === 0) {
    throw new Error('split must include at least one allocation');
  }
  for (const a of input.allocations) {
    assertPositive(a.amount);
    await assertUserExists(db, a.userId);
  }
  await assertUserExists(db, input.createdByUserId);
  const groupId = randomUUID();
  const ids: string[] = [];
  db.transaction((tx) => {
    for (const a of input.allocations) {
      const id = randomUUID();
      ids.push(id);
      tx.insert(charges)
        .values({
          id,
          userId: a.userId,
          type: 'out_of_bounds',
          amount: a.amount,
          description: input.description,
          groupId,
          status: 'open',
          createdByUserId: input.createdByUserId,
        })
        .run();
    }
  });
  const out: Charge[] = [];
  for (const id of ids) {
    const c = await getChargeById(db, id);
    if (c) out.push(c);
  }
  return { groupId, charges: out };
}
