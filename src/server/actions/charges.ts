import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  createAdhocChargeSchema,
  createPotBorrowSchema,
  createSplitChargeSchema,
  chargeMemberDuesSchema,
  idSchema,
} from '@/shared/schemas';
import {
  createAdhocCharge as domainAdhoc,
  createPotBorrow as domainPotBorrow,
  createSplitCharge as domainSplit,
  cancelCharge as domainCancel,
} from '@/server/domain/charges';
import {
  chargeMemberDues as domainChargeMemberDues,
  MemberAlreadyChargedError,
} from '@/server/domain/dues';
import { notifyDuesCreated } from '@/server/jobs/monthly-dues';
import { getNotifier } from '@/server/bot/notifications';
import { formatCents } from '@/shared/format';

export function makeChargeActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const createAdhocCharge = adminAction(async ({ user, db }, input: unknown) => {
    const p = createAdhocChargeSchema.parse(input);
    const charge = await domainAdhoc(db, { ...p, createdByUserId: user.id });
    if (process.env.SKIP_BOT !== '1') {
      try {
        await getNotifier().notifyUser(
          p.userId,
          `🧾 New charge: ${p.description} ${formatCents(charge.amount)}. Type /balance to see total.`,
        );
      } catch (err) { console.error('[actions] notify failed:', err); }
    }
    return charge;
  });

  const createPotBorrow = adminAction(async ({ user, db }, input: unknown) => {
    const p = createPotBorrowSchema.parse(input);
    const charge = await domainPotBorrow(db, { ...p, createdByUserId: user.id });
    if (process.env.SKIP_BOT !== '1') {
      try {
        await getNotifier().notifyUser(
          p.userId,
          `💰 You borrowed ${formatCents(charge.amount)} from the ${p.sourcePot} pot: ${p.description}. Type /balance to see total.`,
        );
      } catch (err) { console.error('[actions] notify failed:', err); }
    }
    return charge;
  });

  const createSplitCharge = adminAction(async ({ user, db }, input: unknown) => {
    const p = createSplitChargeSchema.parse(input);
    const result = await domainSplit(db, { ...p, createdByUserId: user.id });
    if (process.env.SKIP_BOT !== '1') {
      try {
        for (const a of p.allocations) {
          await getNotifier().notifyUser(
            a.userId,
            `🧾 New shared charge: ${p.description} ${formatCents(a.amount)}. Type /balance to see total.`,
          );
        }
      } catch (err) { console.error('[actions] notify failed:', err); }
    }
    return result;
  });

  const cancelCharge = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return domainCancel(db, id);
  });

  const chargeMemberDues = adminAction(async ({ user, db }, input: unknown) => {
    const p = chargeMemberDuesSchema.parse(input);
    try {
      const charge = await domainChargeMemberDues(db, {
        userId: p.userId,
        period: p.period,
        createdByUserId: user.id,
      });
      if (process.env.SKIP_BOT !== '1') {
        try { await notifyDuesCreated(db, charge); }
        catch (err) { console.error('[actions] notify failed:', err); }
      }
      return { ok: true as const, charge };
    } catch (err) {
      if (err instanceof MemberAlreadyChargedError) {
        return {
          ok: false as const,
          reason: 'already_charged' as const,
          existingChargeId: err.existingCharge.id,
          existingStatus: err.existingCharge.status,
        };
      }
      throw err;
    }
  });

  return { createAdhocCharge, createPotBorrow, createSplitCharge, cancelCharge, chargeMemberDues };
}

const prod = makeChargeActions();
export const createAdhocCharge = prod.createAdhocCharge;
export const createPotBorrow = prod.createPotBorrow;
export const createSplitCharge = prod.createSplitCharge;
export const cancelCharge = prod.cancelCharge;
export const chargeMemberDues = prod.chargeMemberDues;
