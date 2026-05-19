import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import { upsertCategorySchema, idSchema } from '@/shared/schemas';
import {
  createCategory,
  renameCategory,
  archiveCategory as domainArchive,
  listCategories as domainList,
} from '@/server/domain/categories';

export function makeCategoryActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const upsertCategory = adminAction(async ({ db }, input: unknown) => {
    const p = upsertCategorySchema.parse(input);
    if (p.id) return renameCategory(db, p.id, p.name);
    return createCategory(db, p.name);
  });

  const archiveCategory = adminAction(async ({ db }, input: { id: string }) => {
    const id = idSchema.parse(input.id);
    return domainArchive(db, id);
  });

  const listCategories = adminAction(async ({ db }, input: { includeArchived?: boolean }) => {
    return domainList(db, { includeArchived: !!input?.includeArchived });
  });

  return { upsertCategory, archiveCategory, listCategories };
}

const prod = makeCategoryActions();
export const upsertCategory = prod.upsertCategory;
export const archiveCategory = prod.archiveCategory;
export const listCategories = prod.listCategories;
