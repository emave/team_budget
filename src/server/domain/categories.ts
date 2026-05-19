import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { categories } from '@/server/db/schema';
import type { Db } from './types';

export async function createCategory(db: Db, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error('category name required');
  const id = randomUUID();
  db.insert(categories).values({ id, name: clean, archived: false }).run();
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}

export async function listCategories(db: Db, opts: { includeArchived?: boolean } = {}) {
  const rows = db.select().from(categories).orderBy(asc(categories.name)).all();
  return opts.includeArchived ? rows : rows.filter((c) => !c.archived);
}

export async function archiveCategory(db: Db, id: string) {
  db.update(categories).set({ archived: true }).where(eq(categories.id, id)).run();
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}

export async function renameCategory(db: Db, id: string, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error('category name required');
  db.update(categories).set({ name: clean }).where(eq(categories.id, id)).run();
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}
