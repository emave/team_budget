import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  recordCreditDepositSchema,
  applyCreditToChargeSchema,
  refundCreditSchema,
  transferCreditSchema,
  cancelCreditMovementSchema,
} from '@/shared/schemas';
import {
  recordCreditDeposit as domainDeposit,
  applyCreditToCharge as domainApply,
  refundCredit as domainRefund,
  transferCredit as domainTransfer,
  cancelCreditMovement as domainCancel,
  getCreditBalance as domainBalance,
  listCreditHistory as domainHistory,
} from '@/server/domain/credit';
import { getUserById } from '@/server/domain/users';
import { getNotifier } from '@/server/bot/notifications';
import { formatCents } from '@/shared/format';
import { detectFromTelegram, getMessages, isLocale } from '@/shared/i18n';

function localeFor(u: { locale: unknown } | null | undefined) {
  return u && isLocale(u.locale) ? u.locale : detectFromTelegram(undefined);
}

function notifySafe(fn: () => Promise<void>) {
  if (process.env.SKIP_BOT === '1') return;
  fn().catch((err) => console.error('[credit] notify failed:', err));
}

export function makeCreditActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const recordCreditDeposit = adminAction(async ({ user, db }, input: unknown) => {
    const p = recordCreditDepositSchema.parse(input);
    const result = await domainDeposit(db, { ...p, createdByUserId: user.id });
    notifySafe(async () => {
      const balance = await domainBalance(db, p.payerUserId);
      await getNotifier().notifyUser(p.payerUserId, (recipient) =>
        getMessages(localeFor(recipient)).wallet.notification.deposit(
          formatCents(p.amount),
          formatCents(balance),
        ),
      );
    });
    return result;
  });

  const applyCreditToCharge = adminAction(async ({ user, db }, input: unknown) => {
    const p = applyCreditToChargeSchema.parse(input);
    return domainApply(db, { ...p, createdByUserId: user.id });
  });

  const refundCredit = adminAction(async ({ user, db }, input: unknown) => {
    const p = refundCreditSchema.parse(input);
    const result = await domainRefund(db, { ...p, createdByUserId: user.id });
    notifySafe(async () => {
      const balance = await domainBalance(db, p.userId);
      await getNotifier().notifyUser(p.userId, (recipient) =>
        getMessages(localeFor(recipient)).wallet.notification.refund(
          formatCents(p.amount),
          p.method === 'cash' ? getMessages(localeFor(recipient)).common.cash : getMessages(localeFor(recipient)).common.card,
          formatCents(balance),
        ),
      );
    });
    return result;
  });

  const transferCredit = adminAction(async ({ user, db }, input: unknown) => {
    const p = transferCreditSchema.parse(input);
    const result = await domainTransfer(db, { ...p, createdByUserId: user.id });
    notifySafe(async () => {
      const fromUser = await getUserById(db, p.fromUserId);
      const toUser = await getUserById(db, p.toUserId);
      if (fromUser) {
        await getNotifier().notifyUser(p.fromUserId, (recipient) =>
          getMessages(localeFor(recipient)).wallet.notification.transferSent(
            formatCents(p.amount),
            toUser?.displayName ?? '?',
          ),
        );
      }
      if (toUser) {
        await getNotifier().notifyUser(p.toUserId, (recipient) =>
          getMessages(localeFor(recipient)).wallet.notification.transferReceived(
            formatCents(p.amount),
            fromUser?.displayName ?? '?',
          ),
        );
      }
    });
    return result;
  });

  const cancelCreditMovement = adminAction(async ({ db }, input: unknown) => {
    const p = cancelCreditMovementSchema.parse(input);
    return domainCancel(db, p.id);
  });

  const getCreditBalance = adminAction(async ({ db }, input: { userId: string }) => {
    return domainBalance(db, input.userId);
  });

  const listCreditHistory = adminAction(async ({ db }, input: { userId: string }) => {
    return domainHistory(db, input.userId);
  });

  return {
    recordCreditDeposit,
    applyCreditToCharge,
    refundCredit,
    transferCredit,
    cancelCreditMovement,
    getCreditBalance,
    listCreditHistory,
  };
}

const prod = makeCreditActions();
export const recordCreditDeposit = prod.recordCreditDeposit;
export const applyCreditToCharge = prod.applyCreditToCharge;
export const refundCredit = prod.refundCredit;
export const transferCredit = prod.transferCredit;
export const cancelCreditMovement = prod.cancelCreditMovement;
export const getCreditBalance = prod.getCreditBalance;
export const listCreditHistory = prod.listCreditHistory;
