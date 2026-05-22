import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  recordGuestDepositSchema,
  cancelGuestDepositSchema,
  guestDepositRangeSchema,
} from '@/shared/schemas';
import {
  recordGuestDeposit as domainRecord,
  cancelGuestDeposit as domainCancel,
  listGuestDeposits as domainList,
  guestDepositSummary as domainSummary,
} from '@/server/domain/guest-deposits';

export function makeGuestDepositActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const recordGuestDeposit = adminAction(async ({ user, db }, input: unknown) => {
    const p = recordGuestDepositSchema.parse(input);
    return domainRecord(db, {
      guestId: p.guestId ?? null,
      amount: p.amount,
      method: p.method,
      note: p.note,
      receivedAt: p.receivedAt,
      createdByUserId: user.id,
    });
  });

  const cancelGuestDeposit = adminAction(async ({ db }, input: unknown) => {
    const p = cancelGuestDepositSchema.parse(input);
    return domainCancel(db, p.id);
  });

  const guestDepositSummary = adminAction(async ({ db }, input: unknown) => {
    const p = guestDepositRangeSchema.parse(input);
    return domainSummary(db, p);
  });

  const listGuestDeposits = adminAction(async ({ db }, input: { guestId?: string | null } | undefined) => {
    return domainList(db, { guestId: input?.guestId ?? undefined });
  });

  return { recordGuestDeposit, cancelGuestDeposit, guestDepositSummary, listGuestDeposits };
}

const prod = makeGuestDepositActions();
export const recordGuestDeposit = prod.recordGuestDeposit;
export const cancelGuestDeposit = prod.cancelGuestDeposit;
export const guestDepositSummary = prod.guestDepositSummary;
export const listGuestDeposits = prod.listGuestDeposits;
