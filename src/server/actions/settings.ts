import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import { updateDuesAmountSchema, updatePotOpeningsSchema } from '@/shared/schemas';
import {
  getOrCreateSettings,
  updateMonthlyDuesAmount as domainUpdate,
  updatePotOpenings as domainUpdatePotOpenings,
} from '@/server/domain/settings';
import { runMonthlyDuesOnce } from '@/server/jobs/monthly-dues';

export function makeSettingsActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const getSettings = adminAction(async ({ db }) => getOrCreateSettings(db));

  const updateMonthlyDuesAmount = adminAction(async ({ db }, input: unknown) => {
    const p = updateDuesAmountSchema.parse(input);
    return domainUpdate(db, p.amount);
  });

  const runDuesNow = adminAction(async ({ db }) => runMonthlyDuesOnce(db));

  const updatePotOpenings = adminAction(async ({ db }, input: unknown) => {
    const p = updatePotOpeningsSchema.parse(input);
    return domainUpdatePotOpenings(db, p.cashCents, p.cardCents);
  });

  return { getSettings, updateMonthlyDuesAmount, runDuesNow, updatePotOpenings };
}

const prod = makeSettingsActions();
export const getSettings = prod.getSettings;
export const updateMonthlyDuesAmount = prod.updateMonthlyDuesAmount;
export const runDuesNow = prod.runDuesNow;
export const updatePotOpenings = prod.updatePotOpenings;
