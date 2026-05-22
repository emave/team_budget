import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import {
  payments,
  spendings,
  users,
  guests,
  guestDeposits,
  creditMovements,
} from '@/server/db/schema';
import type { Db } from './types';

export type Movement =
  | {
      kind: 'deposit';
      id: string;
      at: string;
      amount: number;
      method: 'cash' | 'card';
      payerUserId: string;
      payerDisplayName: string;
      note: string | null;
    }
  | {
      kind: 'guest_deposit';
      id: string;
      at: string;
      amount: number;
      method: 'cash' | 'card';
      guestId: string | null;
      guestName: string | null;
      note: string | null;
    }
  | {
      kind: 'withdraw';
      id: string;
      at: string;
      amount: number;
      pot: 'cash' | 'card';
      description: string;
    }
  | {
      kind: 'credit_refund';
      id: string;
      at: string;
      amount: number;
      method: 'cash' | 'card';
      userId: string;
      userDisplayName: string;
      note: string | null;
    };

export async function listMoneyMovements(
  db: Db,
  range: { from: string; to: string },
): Promise<Movement[]> {
  const fromBound = `${range.from}T00:00:00.000Z`;
  const toBound = `${range.to}T23:59:59.999Z`;

  const ps = db
    .select({
      id: payments.id,
      at: payments.receivedAt,
      amount: payments.amount,
      method: payments.method,
      payerUserId: payments.payerUserId,
      payerDisplayName: users.displayName,
      note: payments.note,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.payerUserId))
    .where(
      and(
        isNull(payments.cancelledAt),
        eq(payments.excludeFromPot, false),
        gte(payments.receivedAt, fromBound),
        lte(payments.receivedAt, toBound),
      ),
    )
    .all();

  const rfs = db
    .select({
      id: creditMovements.id,
      at: creditMovements.occurredAt,
      amount: creditMovements.amount,
      method: creditMovements.method,
      userId: creditMovements.userId,
      userDisplayName: users.displayName,
      note: creditMovements.note,
    })
    .from(creditMovements)
    .innerJoin(users, eq(users.id, creditMovements.userId))
    .where(
      and(
        eq(creditMovements.kind, 'refund'),
        isNull(creditMovements.cancelledAt),
        gte(creditMovements.occurredAt, fromBound),
        lte(creditMovements.occurredAt, toBound),
      ),
    )
    .all();

  const gs = db
    .select({
      id: guestDeposits.id,
      at: guestDeposits.receivedAt,
      amount: guestDeposits.amount,
      method: guestDeposits.method,
      guestId: guestDeposits.guestId,
      guestName: guests.name,
      note: guestDeposits.note,
    })
    .from(guestDeposits)
    .leftJoin(guests, eq(guests.id, guestDeposits.guestId))
    .where(
      and(
        isNull(guestDeposits.cancelledAt),
        gte(guestDeposits.receivedAt, fromBound),
        lte(guestDeposits.receivedAt, toBound),
      ),
    )
    .all();

  const ss = db
    .select({
      id: spendings.id,
      at: spendings.occurredAt,
      amount: spendings.amount,
      pot: spendings.pot,
      description: spendings.description,
    })
    .from(spendings)
    .where(
      and(
        isNull(spendings.cancelledAt),
        gte(spendings.occurredAt, fromBound),
        lte(spendings.occurredAt, toBound),
      ),
    )
    .all();

  const merged: Movement[] = [
    ...ps.map((p): Movement => ({
      kind: 'deposit',
      id: p.id, at: p.at, amount: p.amount, method: p.method,
      payerUserId: p.payerUserId, payerDisplayName: p.payerDisplayName, note: p.note,
    })),
    ...gs.map((g): Movement => ({
      kind: 'guest_deposit',
      id: g.id, at: g.at, amount: g.amount, method: g.method,
      guestId: g.guestId, guestName: g.guestName, note: g.note,
    })),
    ...ss.map((s): Movement => ({
      kind: 'withdraw',
      id: s.id, at: s.at, amount: s.amount, pot: s.pot, description: s.description,
    })),
    ...rfs.map((r): Movement => ({
      kind: 'credit_refund',
      id: r.id, at: r.at, amount: r.amount, method: r.method!,
      userId: r.userId, userDisplayName: r.userDisplayName, note: r.note,
    })),
  ];

  merged.sort((a, b) => {
    if (a.at !== b.at) return a.at > b.at ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });

  return merged;
}
