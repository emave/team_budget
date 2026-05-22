import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  createGuestSchema,
  renameGuestSchema,
  archiveGuestSchema,
} from '@/shared/schemas';
import {
  createGuest as domainCreate,
  renameGuest as domainRename,
  archiveGuest as domainArchive,
  unarchiveGuest as domainUnarchive,
  listGuests as domainList,
} from '@/server/domain/guests';

export function makeGuestActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const createGuest = adminAction(async ({ user, db }, input: unknown) => {
    const p = createGuestSchema.parse(input);
    return domainCreate(db, { name: p.name, createdByUserId: user.id });
  });

  const renameGuest = adminAction(async ({ db }, input: unknown) => {
    const p = renameGuestSchema.parse(input);
    return domainRename(db, p.id, p.name);
  });

  const archiveGuest = adminAction(async ({ db }, input: unknown) => {
    const p = archiveGuestSchema.parse(input);
    return domainArchive(db, p.id);
  });

  const unarchiveGuest = adminAction(async ({ db }, input: unknown) => {
    const p = archiveGuestSchema.parse(input);
    return domainUnarchive(db, p.id);
  });

  const listGuests = adminAction(async ({ db }, input: { includeArchived?: boolean } | undefined) => {
    return domainList(db, { includeArchived: input?.includeArchived ?? false });
  });

  return { createGuest, renameGuest, archiveGuest, unarchiveGuest, listGuests };
}

const prod = makeGuestActions();
export const createGuest = prod.createGuest;
export const renameGuest = prod.renameGuest;
export const archiveGuest = prod.archiveGuest;
export const unarchiveGuest = prod.unarchiveGuest;
export const listGuests = prod.listGuests;
