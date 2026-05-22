import { and, desc, eq, isNull, sum } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { guests, guestDeposits } from '@/server/db/schema';
import type { Db } from './types';

export type GuestDeposit = typeof guestDeposits.$inferSelect;
export type Pot = 'cash' | 'card';

export interface RecordGuestDepositInput {
  guestId?: string | null;
  amount: number;
  method: Pot;
  note?: string | null;
  receivedAt?: string;
  createdByUserId: string;
}

function assertPositive(n: number) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`amount must be a positive integer, got ${n}`);
  }
}

export async function recordGuestDeposit(
  db: Db,
  input: RecordGuestDepositInput,
): Promise<GuestDeposit> {
  assertPositive(input.amount);
  if (input.method !== 'cash' && input.method !== 'card') {
    throw new Error(`invalid method: ${String(input.method)}`);
  }
  if (input.guestId) {
    const g = db.select().from(guests).where(eq(guests.id, input.guestId)).get();
    if (!g) throw new Error(`guest ${input.guestId} not found`);
    if (g.archived) throw new Error(`guest ${input.guestId} is archived`);
  }
  const id = randomUUID();
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  db.insert(guestDeposits)
    .values({
      id,
      guestId: input.guestId ?? null,
      amount: input.amount,
      method: input.method,
      note: input.note ?? null,
      receivedAt,
      createdByUserId: input.createdByUserId,
    })
    .run();
  return db.select().from(guestDeposits).where(eq(guestDeposits.id, id)).get()!;
}

export async function cancelGuestDeposit(db: Db, id: string): Promise<GuestDeposit> {
  const d = db.select().from(guestDeposits).where(eq(guestDeposits.id, id)).get();
  if (!d) throw new Error(`guest deposit ${id} not found`);
  if (d.cancelledAt) return d;
  db.update(guestDeposits)
    .set({ cancelledAt: new Date().toISOString() })
    .where(eq(guestDeposits.id, id))
    .run();
  return db.select().from(guestDeposits).where(eq(guestDeposits.id, id)).get()!;
}

export interface ListGuestDepositsOptions {
  guestId?: string | null;
  range?: { from: string; to: string };
  limit?: number;
  includeCancelled?: boolean;
}

export async function listGuestDeposits(
  db: Db,
  opts: ListGuestDepositsOptions = {},
): Promise<GuestDeposit[]> {
  let rows = db.select().from(guestDeposits).orderBy(desc(guestDeposits.receivedAt)).all();
  if (!opts.includeCancelled) rows = rows.filter((r) => !r.cancelledAt);
  if (opts.guestId !== undefined) rows = rows.filter((r) => r.guestId === opts.guestId);
  if (opts.range) {
    const from = `${opts.range.from}T00:00:00.000Z`;
    const to = `${opts.range.to}T23:59:59.999Z`;
    rows = rows.filter((r) => r.receivedAt >= from && r.receivedAt <= to);
  }
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

export async function sumGuestDepositsByMethod(db: Db, method: Pot): Promise<number> {
  const row = db
    .select({ s: sum(guestDeposits.amount) })
    .from(guestDeposits)
    .where(and(eq(guestDeposits.method, method), isNull(guestDeposits.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}
