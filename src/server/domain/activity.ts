import { desc } from 'drizzle-orm';
import { charges, payments, spendings, users } from '@/server/db/schema';
import type { Db } from './types';

export type ActivityEvent =
  | { kind: 'charge'; id: string; createdAt: string; amount: number; description: string; userDisplayName: string }
  | { kind: 'payment'; id: string; createdAt: string; amount: number; method: 'cash' | 'card'; payerDisplayName: string }
  | { kind: 'spending'; id: string; createdAt: string; amount: number; pot: 'cash' | 'card'; description: string };

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
  ];

  events.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return events.slice(0, limit);
}
