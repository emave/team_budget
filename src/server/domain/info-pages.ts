import { asc, eq, max } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { infoPages } from '@/server/db/schema';
import type { Db } from './types';

export interface CreateInfoPageInput {
  title: string;
  body: string;
  updatedByUserId: string;
}

export async function createInfoPage(db: Db, input: CreateInfoPageInput) {
  const title = input.title.trim();
  if (!title) throw new Error('title required');
  const id = randomUUID();
  const maxRow = db.select({ m: max(infoPages.sortOrder) }).from(infoPages).get();
  const nextOrder = (Number(maxRow?.m ?? -1)) + 1;
  const now = new Date().toISOString();
  db.insert(infoPages)
    .values({
      id,
      title,
      body: input.body,
      sortOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
      updatedByUserId: input.updatedByUserId,
    })
    .run();
  return db.select().from(infoPages).where(eq(infoPages.id, id)).get()!;
}

export async function updateInfoPage(
  db: Db,
  id: string,
  input: { title?: string; body?: string; updatedByUserId: string },
) {
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedByUserId: input.updatedByUserId,
  };
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new Error('title required');
    patch.title = t;
  }
  if (input.body !== undefined) patch.body = input.body;
  db.update(infoPages).set(patch).where(eq(infoPages.id, id)).run();
  return db.select().from(infoPages).where(eq(infoPages.id, id)).get()!;
}

export async function listInfoPages(db: Db) {
  return db.select().from(infoPages).orderBy(asc(infoPages.sortOrder)).all();
}

export async function reorderInfoPages(db: Db, orderedIds: string[]) {
  db.transaction((tx) => {
    orderedIds.forEach((id, idx) => {
      tx.update(infoPages).set({ sortOrder: idx }).where(eq(infoPages.id, id)).run();
    });
  });
}

export async function deleteInfoPage(db: Db, id: string) {
  db.delete(infoPages).where(eq(infoPages.id, id)).run();
}
