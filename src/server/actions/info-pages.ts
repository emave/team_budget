import 'server-only';
import { makeAdminAction, makeMemberAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  upsertInfoPageSchema,
  reorderInfoPagesSchema,
  idSchema,
} from '@/shared/schemas';
import {
  createInfoPage,
  updateInfoPage,
  listInfoPages as domainList,
  reorderInfoPages as domainReorder,
  deleteInfoPage as domainDelete,
} from '@/server/domain/info-pages';

export function makeInfoPageActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);
  const memberAction = makeMemberAction(deps);

  const upsertInfoPage = adminAction(async ({ user, db }, input: unknown) => {
    const p = upsertInfoPageSchema.parse(input);
    if (p.id) {
      return updateInfoPage(db, p.id, { title: p.title, body: p.body, updatedByUserId: user.id });
    }
    return createInfoPage(db, { title: p.title, body: p.body, updatedByUserId: user.id });
  });

  const reorderInfoPages = adminAction(async ({ db }, input: unknown) => {
    const p = reorderInfoPagesSchema.parse(input);
    await domainReorder(db, p.orderedIds);
    return { ok: true };
  });

  const deleteInfoPage = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    await domainDelete(db, id);
    return { ok: true };
  });

  // Readable by any member
  const listInfoPages = memberAction(async ({ db }) => domainList(db));

  return { upsertInfoPage, reorderInfoPages, deleteInfoPage, listInfoPages };
}

const prod = makeInfoPageActions();
export const upsertInfoPage = prod.upsertInfoPage;
export const reorderInfoPages = prod.reorderInfoPages;
export const deleteInfoPage = prod.deleteInfoPage;
export const listInfoPages = prod.listInfoPages;
