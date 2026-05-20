import 'server-only';
import { z } from 'zod';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import { recordPaymentSchema, idSchema, moneySchema } from '@/shared/schemas';
import {
  recordPayment as domainRecord,
  cancelPayment as domainCancel,
  fifoAllocate,
} from '@/server/domain/payments';
import { getNotifier } from '@/server/bot/notifications';
import { formatCents } from '@/shared/format';
import { getMemberOutstandingDebt } from '@/server/domain/charges';

export function makePaymentActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const recordPayment = adminAction(async ({ user, db }, input: unknown) => {
    const p = recordPaymentSchema.parse(input);
    const result = await domainRecord(db, { ...p, createdByUserId: user.id });
    if (process.env.SKIP_BOT !== '1') {
      try {
        const remaining = await getMemberOutstandingDebt(db, p.payerUserId);
        await getNotifier().notifyUser(
          p.payerUserId,
          `💵 Payment ${formatCents(result.payment.amount)} (${result.payment.method}) recorded. Remaining: ${formatCents(remaining)}.`,
        );
      } catch (err) { console.error('[actions] notify failed:', err); }
    }
    return result;
  });

  const cancelPayment = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return domainCancel(db, id);
  });

  const suggestSchema = z.object({ payerUserId: idSchema, amount: moneySchema });
  const suggestFifoAllocation = adminAction(async ({ db }, input: unknown) => {
    const p = suggestSchema.parse(input);
    return fifoAllocate(db, p.payerUserId, p.amount);
  });

  return { recordPayment, cancelPayment, suggestFifoAllocation };
}

const prod = makePaymentActions();
export const recordPayment = prod.recordPayment;
export const cancelPayment = prod.cancelPayment;
export const suggestFifoAllocation = prod.suggestFifoAllocation;
