import { and, desc, eq, isNull } from 'drizzle-orm';
import { guestDeposits, guests, payments, users } from '@/server/db/schema';
import type { Db } from './types';

export type DepositSource = 'member' | 'guest';

export interface UnifiedDeposit {
  id: string;
  source: DepositSource;
  personId: string | null;
  personName: string;
  personArchived: boolean;
  receivedAt: string;
  amount: number;
  method: 'cash' | 'card';
  note: string | null;
}

export interface ListDepositsOptions {
  source?: 'all' | DepositSource;
  personId?: string;
  range?: { from: string; to: string };
}

export async function listDeposits(
  db: Db,
  opts: ListDepositsOptions = {},
): Promise<UnifiedDeposit[]> {
  const source = opts.source ?? 'all';
  const fromBound = opts.range ? `${opts.range.from}T00:00:00.000Z` : null;
  const toBound = opts.range ? `${opts.range.to}T23:59:59.999Z` : null;

  const out: UnifiedDeposit[] = [];

  if (source === 'all' || source === 'member') {
    const rows = db
      .select({
        id: payments.id,
        userId: payments.payerUserId,
        userName: users.displayName,
        receivedAt: payments.receivedAt,
        amount: payments.amount,
        method: payments.method,
        note: payments.note,
      })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.payerUserId))
      .where(
        and(
          eq(payments.kind, 'wallet_deposit'),
          isNull(payments.cancelledAt),
          opts.personId && source === 'member' ? eq(payments.payerUserId, opts.personId) : undefined,
        ),
      )
      .all();

    for (const r of rows) {
      if (fromBound && r.receivedAt < fromBound) continue;
      if (toBound && r.receivedAt > toBound) continue;
      out.push({
        id: r.id,
        source: 'member',
        personId: r.userId,
        personName: r.userName,
        personArchived: false,
        receivedAt: r.receivedAt,
        amount: r.amount,
        method: r.method,
        note: r.note,
      });
    }
  }

  if (source === 'all' || source === 'guest') {
    const rows = db
      .select({
        id: guestDeposits.id,
        guestId: guestDeposits.guestId,
        guestName: guests.name,
        guestArchived: guests.archived,
        receivedAt: guestDeposits.receivedAt,
        amount: guestDeposits.amount,
        method: guestDeposits.method,
        note: guestDeposits.note,
      })
      .from(guestDeposits)
      .leftJoin(guests, eq(guests.id, guestDeposits.guestId))
      .where(isNull(guestDeposits.cancelledAt))
      .all();

    for (const r of rows) {
      if (fromBound && r.receivedAt < fromBound) continue;
      if (toBound && r.receivedAt > toBound) continue;
      if (opts.personId && source === 'guest' && r.guestId !== opts.personId) continue;
      out.push({
        id: r.id,
        source: 'guest',
        personId: r.guestId,
        personName: r.guestName ?? '',
        personArchived: r.guestArchived ?? false,
        receivedAt: r.receivedAt,
        amount: r.amount,
        method: r.method,
        note: r.note,
      });
    }
  }

  // For the 'all' tab, the personId filter could match either a userId or a guestId.
  // Above we only applied it inside each source branch; when source='all' we apply
  // it post-merge so it works for both.
  let merged = out;
  if (opts.personId && source === 'all') {
    merged = merged.filter((d) => d.personId === opts.personId);
  }

  merged.sort((a, b) => (b.receivedAt > a.receivedAt ? 1 : -1));
  return merged;
}
