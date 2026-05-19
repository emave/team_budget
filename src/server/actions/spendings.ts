import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import { recordSpendingSchema, idSchema } from '@/shared/schemas';
import {
  recordSpending as domainRecord,
  cancelSpending as domainCancel,
} from '@/server/domain/spendings';

export function makeSpendingActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const recordSpending = adminAction(async ({ user, db }, input: unknown) => {
    const p = recordSpendingSchema.parse(input);
    return domainRecord(db, { ...p, createdByUserId: user.id });
  });

  const cancelSpending = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return domainCancel(db, id);
  });

  return { recordSpending, cancelSpending };
}

const prod = makeSpendingActions();
export const recordSpending = prod.recordSpending;
export const cancelSpending = prod.cancelSpending;
