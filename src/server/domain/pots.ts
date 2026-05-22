import { and, eq, isNull, sum } from 'drizzle-orm';
import { charges, creditMovements, payments, spendings } from '@/server/db/schema';
import { getOrCreateSettings } from './settings';
import { sumGuestDepositsByMethod } from './guest-deposits';
import type { Db } from './types';

export interface PotBalances {
  cash: number;
  card: number;
}

async function sumPaymentsByMethod(db: Db, method: 'cash' | 'card'): Promise<number> {
  const row = db
    .select({ s: sum(payments.amount) })
    .from(payments)
    .where(and(eq(payments.method, method), isNull(payments.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}

async function sumSpendingsByPot(db: Db, pot: 'cash' | 'card'): Promise<number> {
  const row = db
    .select({ s: sum(spendings.amount) })
    .from(spendings)
    .where(and(eq(spendings.pot, pot), isNull(spendings.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}

async function sumPotBorrows(db: Db, pot: 'cash' | 'card'): Promise<number> {
  const rows = db
    .select({ amount: charges.amount, status: charges.status })
    .from(charges)
    .where(and(eq(charges.type, 'pot_borrow'), eq(charges.sourcePot, pot)))
    .all();
  return rows.filter((r) => r.status !== 'cancelled').reduce((s, r) => s + r.amount, 0);
}

async function sumRefundsByMethod(db: Db, method: 'cash' | 'card'): Promise<number> {
  const row = db
    .select({ s: sum(creditMovements.amount) })
    .from(creditMovements)
    .where(
      and(
        eq(creditMovements.kind, 'refund'),
        eq(creditMovements.method, method),
        isNull(creditMovements.cancelledAt),
      ),
    )
    .get();
  return Number(row?.s ?? 0);
}

export async function getPotBalances(db: Db): Promise<PotBalances> {
  const [
    s,
    cashIn, cashOut, cashBorrow, cashGuest, cashRefund,
    cardIn, cardOut, cardBorrow, cardGuest, cardRefund,
  ] = await Promise.all([
    getOrCreateSettings(db),
    sumPaymentsByMethod(db, 'cash'),
    sumSpendingsByPot(db, 'cash'),
    sumPotBorrows(db, 'cash'),
    sumGuestDepositsByMethod(db, 'cash'),
    sumRefundsByMethod(db, 'cash'),
    sumPaymentsByMethod(db, 'card'),
    sumSpendingsByPot(db, 'card'),
    sumPotBorrows(db, 'card'),
    sumGuestDepositsByMethod(db, 'card'),
    sumRefundsByMethod(db, 'card'),
  ]);
  return {
    cash: s.cashOpeningCents + cashIn + cashGuest - cashOut - cashBorrow - cashRefund,
    card: s.cardOpeningCents + cardIn + cardGuest - cardOut - cardBorrow - cardRefund,
  };
}
