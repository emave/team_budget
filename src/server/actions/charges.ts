import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  createAdhocChargeSchema,
  createPotBorrowSchema,
  createSplitChargeSchema,
  idSchema,
} from '@/shared/schemas';
import {
  createAdhocCharge as domainAdhoc,
  createPotBorrow as domainPotBorrow,
  createSplitCharge as domainSplit,
  cancelCharge as domainCancel,
} from '@/server/domain/charges';

export function makeChargeActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const createAdhocCharge = adminAction(async ({ user, db }, input: unknown) => {
    const p = createAdhocChargeSchema.parse(input);
    return domainAdhoc(db, { ...p, createdByUserId: user.id });
  });

  const createPotBorrow = adminAction(async ({ user, db }, input: unknown) => {
    const p = createPotBorrowSchema.parse(input);
    return domainPotBorrow(db, { ...p, createdByUserId: user.id });
  });

  const createSplitCharge = adminAction(async ({ user, db }, input: unknown) => {
    const p = createSplitChargeSchema.parse(input);
    return domainSplit(db, { ...p, createdByUserId: user.id });
  });

  const cancelCharge = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return domainCancel(db, id);
  });

  return { createAdhocCharge, createPotBorrow, createSplitCharge, cancelCharge };
}

const prod = makeChargeActions();
export const createAdhocCharge = prod.createAdhocCharge;
export const createPotBorrow = prod.createPotBorrow;
export const createSplitCharge = prod.createSplitCharge;
export const cancelCharge = prod.cancelCharge;
