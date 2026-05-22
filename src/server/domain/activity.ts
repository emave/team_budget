import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  charges,
  payments,
  spendings,
  users,
  guests,
  guestDeposits,
  creditMovements,
} from '@/server/db/schema';
import type { Db } from './types';

export type ActivityEvent =
  | { kind: 'charge'; id: string; createdAt: string; amount: number; description: string; userDisplayName: string }
  | { kind: 'payment'; id: string; createdAt: string; amount: number; method: 'cash' | 'card'; payerDisplayName: string }
  | { kind: 'spending'; id: string; createdAt: string; amount: number; pot: 'cash' | 'card'; description: string }
  | { kind: 'guest_deposit'; id: string; createdAt: string; amount: number; method: 'cash' | 'card'; guestId: string | null; guestName: string | null }
  | { kind: 'credit_refund'; id: string; createdAt: string; amount: number; method: 'cash' | 'card'; userId: string; userDisplayName: string }
  | { kind: 'credit_transfer'; id: string; createdAt: string; amount: number; groupId: string; fromUserId: string; fromDisplayName: string; toUserId: string; toDisplayName: string };

export async function recentActivity(db: Db, limit: number): Promise<ActivityEvent[]> {
  const cs = db
    .select({
      id: charges.id,
      createdAt: charges.createdAt,
      amount: charges.amount,
      description: charges.description,
      userId: charges.userId,
    })
    .from(charges)
    .orderBy(desc(charges.createdAt))
    .limit(limit)
    .all();

  const ps = db
    .select({
      id: payments.id,
      createdAt: payments.createdAt,
      amount: payments.amount,
      method: payments.method,
      payerUserId: payments.payerUserId,
    })
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .all();

  const ss = db
    .select({
      id: spendings.id,
      createdAt: spendings.createdAt,
      amount: spendings.amount,
      pot: spendings.pot,
      description: spendings.description,
    })
    .from(spendings)
    .orderBy(desc(spendings.createdAt))
    .limit(limit)
    .all();

  const gs = db
    .select({
      id: guestDeposits.id,
      createdAt: guestDeposits.createdAt,
      amount: guestDeposits.amount,
      method: guestDeposits.method,
      guestId: guestDeposits.guestId,
      guestName: guests.name,
    })
    .from(guestDeposits)
    .leftJoin(guests, eq(guests.id, guestDeposits.guestId))
    .orderBy(desc(guestDeposits.createdAt))
    .limit(limit)
    .all();

  const rfs = db
    .select({
      id: creditMovements.id,
      createdAt: creditMovements.createdAt,
      amount: creditMovements.amount,
      method: creditMovements.method,
      userId: creditMovements.userId,
    })
    .from(creditMovements)
    .where(and(eq(creditMovements.kind, 'refund'), isNull(creditMovements.cancelledAt)))
    .orderBy(desc(creditMovements.createdAt))
    .limit(limit)
    .all();

  const tfs = db
    .select({
      id: creditMovements.id,
      createdAt: creditMovements.createdAt,
      amount: creditMovements.amount,
      groupId: creditMovements.groupId,
      userId: creditMovements.userId,
      counterpartyUserId: creditMovements.counterpartyUserId,
    })
    .from(creditMovements)
    .where(and(eq(creditMovements.kind, 'transfer_out'), isNull(creditMovements.cancelledAt)))
    .orderBy(desc(creditMovements.createdAt))
    .limit(limit)
    .all();

  const userNames = new Map<string, string>();
  for (const u of db.select({ id: users.id, displayName: users.displayName }).from(users).all()) {
    userNames.set(u.id, u.displayName);
  }

  const events: ActivityEvent[] = [
    ...cs.map((c): ActivityEvent => ({
      kind: 'charge',
      id: c.id,
      createdAt: c.createdAt,
      amount: c.amount,
      description: c.description,
      userDisplayName: userNames.get(c.userId) ?? '?',
    })),
    ...ps.map((p): ActivityEvent => ({
      kind: 'payment',
      id: p.id,
      createdAt: p.createdAt,
      amount: p.amount,
      method: p.method,
      payerDisplayName: userNames.get(p.payerUserId) ?? '?',
    })),
    ...ss.map((s): ActivityEvent => ({
      kind: 'spending',
      id: s.id,
      createdAt: s.createdAt,
      amount: s.amount,
      pot: s.pot,
      description: s.description,
    })),
    ...gs.map((g): ActivityEvent => ({
      kind: 'guest_deposit',
      id: g.id,
      createdAt: g.createdAt,
      amount: g.amount,
      method: g.method,
      guestId: g.guestId,
      guestName: g.guestName ?? null,
    })),
    ...rfs.map((r): ActivityEvent => ({
      kind: 'credit_refund',
      id: r.id,
      createdAt: r.createdAt,
      amount: r.amount,
      method: r.method!,
      userId: r.userId,
      userDisplayName: userNames.get(r.userId) ?? '?',
    })),
    ...tfs.map((t): ActivityEvent => ({
      kind: 'credit_transfer',
      id: t.id,
      createdAt: t.createdAt,
      amount: t.amount,
      groupId: t.groupId!,
      fromUserId: t.userId,
      fromDisplayName: userNames.get(t.userId) ?? '?',
      toUserId: t.counterpartyUserId!,
      toDisplayName: userNames.get(t.counterpartyUserId!) ?? '?',
    })),
  ];

  events.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return events.slice(0, limit);
}
