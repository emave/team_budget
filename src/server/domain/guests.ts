import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { guests } from '@/server/db/schema';
import type { Db } from './types';

export type Guest = typeof guests.$inferSelect;

export interface CreateGuestInput {
  name: string;
  createdByUserId: string;
}

export async function createGuest(db: Db, input: CreateGuestInput): Promise<Guest> {
  const name = input.name.trim();
  if (!name) throw new Error('guest name required');
  const id = randomUUID();
  db.insert(guests)
    .values({ id, name, archived: false, createdByUserId: input.createdByUserId })
    .run();
  return db.select().from(guests).where(eq(guests.id, id)).get()!;
}

export async function getGuest(db: Db, id: string): Promise<Guest | undefined> {
  return db.select().from(guests).where(eq(guests.id, id)).get();
}

export async function listGuests(
  db: Db,
  opts: { includeArchived?: boolean } = {},
): Promise<Guest[]> {
  const rows = db.select().from(guests).orderBy(asc(guests.name)).all();
  return opts.includeArchived ? rows : rows.filter((g) => !g.archived);
}

export async function renameGuest(db: Db, id: string, name: string): Promise<Guest> {
  const clean = name.trim();
  if (!clean) throw new Error('guest name required');
  db.update(guests).set({ name: clean }).where(eq(guests.id, id)).run();
  const g = await getGuest(db, id);
  if (!g) throw new Error(`guest ${id} not found`);
  return g;
}

export async function archiveGuest(db: Db, id: string): Promise<Guest> {
  db.update(guests).set({ archived: true }).where(eq(guests.id, id)).run();
  const g = await getGuest(db, id);
  if (!g) throw new Error(`guest ${id} not found`);
  return g;
}

export async function unarchiveGuest(db: Db, id: string): Promise<Guest> {
  db.update(guests).set({ archived: false }).where(eq(guests.id, id)).run();
  const g = await getGuest(db, id);
  if (!g) throw new Error(`guest ${id} not found`);
  return g;
}
