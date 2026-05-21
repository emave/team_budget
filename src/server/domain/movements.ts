import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { payments, spendings, users } from '@/server/db/schema';
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
      kind: 'withdraw';
      id: string;
      at: string;
      amount: number;
      pot: 'cash' | 'card';
      description: string;
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
        gte(payments.receivedAt, fromBound),
        lte(payments.receivedAt, toBound),
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
      id: p.id,
      at: p.at,
      amount: p.amount,
      method: p.method,
      payerUserId: p.payerUserId,
      payerDisplayName: p.payerDisplayName,
      note: p.note,
    })),
    ...ss.map((s): Movement => ({
      kind: 'withdraw',
      id: s.id,
      at: s.at,
      amount: s.amount,
      pot: s.pot,
      description: s.description,
    })),
  ];

  merged.sort((a, b) => {
    if (a.at !== b.at) return a.at > b.at ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });

  return merged;
}
