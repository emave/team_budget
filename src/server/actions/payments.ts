import 'server-only';
import { z } from 'zod';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import { recordPaymentSchema, idSchema } from '@/shared/schemas';
import {
  recordPayment as domainRecord,
  cancelPayment as domainCancel,
} from '@/server/domain/payments';
import { getNotifier } from '@/server/bot/notifications';
import { formatCents } from '@/shared/format';
import { detectFromTelegram, getMessages, isLocale } from '@/shared/i18n';
import {
  getMemberOutstandingDebt,
  listOpenChargesForMember,
  sumAllocationsForCharge,
} from '@/server/domain/charges';

export interface OpenChargeForPayer {
  id: string;
  type: 'monthly_dues' | 'out_of_bounds' | 'adhoc' | 'pot_borrow';
  description: string;
  amount: number;
  allocatedCents: number;
  remainingCents: number;
  billingPeriod: string | null;
  createdAt: string;
}

export function makePaymentActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const recordPayment = adminAction(async ({ user, db }, input: unknown) => {
    const p = recordPaymentSchema.parse(input);
    const result = await domainRecord(db, { ...p, createdByUserId: user.id });
    if (process.env.SKIP_BOT !== '1') {
      try {
        const remaining = await getMemberOutstandingDebt(db, p.payerUserId);
        await getNotifier().notifyUser(p.payerUserId, (recipient) => {
          const locale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
          return getMessages(locale).bot.pay.notifyPaid(
            formatCents(result.payment.amount),
            result.payment.method,
            formatCents(remaining),
          );
        });
      } catch (err) { console.error('[actions] notify failed:', err); }
    }
    return result;
  });

  const cancelPayment = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return domainCancel(db, id);
  });

  const listOpenChargesSchema = z.object({ payerUserId: idSchema });
  const listOpenChargesForPayer = adminAction(async ({ db }, input: unknown) => {
    const { payerUserId } = listOpenChargesSchema.parse(input);
    const charges = await listOpenChargesForMember(db, payerUserId);
    const out: OpenChargeForPayer[] = [];
    for (const c of charges) {
      const allocated = await sumAllocationsForCharge(db, c.id);
      const remaining = c.amount - allocated;
      if (remaining <= 0) continue;
      out.push({
        id: c.id,
        type: c.type,
        description: c.description,
        amount: c.amount,
        allocatedCents: allocated,
        remainingCents: remaining,
        billingPeriod: c.billingPeriod,
        createdAt: c.createdAt,
      });
    }
    return out;
  });

  return { recordPayment, cancelPayment, listOpenChargesForPayer };
}

const prod = makePaymentActions();
export const recordPayment = prod.recordPayment;
export const cancelPayment = prod.cancelPayment;
export const listOpenChargesForPayer = prod.listOpenChargesForPayer;
