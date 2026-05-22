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

export function makeCreditActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const recordCreditDeposit = adminAction(async ({ user, db }, input: unknown) => {
    const p = recordCreditDepositSchema.parse(input);
    return domainDeposit(db, { ...p, createdByUserId: user.id });
  });

  const applyCreditToCharge = adminAction(async ({ user, db }, input: unknown) => {
    const p = applyCreditToChargeSchema.parse(input);
    return domainApply(db, { ...p, createdByUserId: user.id });
  });

  const refundCredit = adminAction(async ({ user, db }, input: unknown) => {
    const p = refundCreditSchema.parse(input);
    return domainRefund(db, { ...p, createdByUserId: user.id });
  });

  const transferCredit = adminAction(async ({ user, db }, input: unknown) => {
    const p = transferCreditSchema.parse(input);
    return domainTransfer(db, { ...p, createdByUserId: user.id });
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
