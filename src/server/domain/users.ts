import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { users } from '@/server/db/schema';
import type { Locale } from '@/shared/i18n';
import type { Db } from './types';

export type Role = 'admin' | 'member';

export interface CreateUserInput {
  telegramUserId: number;
  telegramUsername?: string | null;
  displayName: string;
  photoUrl?: string | null;
  role: Role;
  locale?: Locale | null;
}

export async function createUser(db: Db, input: CreateUserInput) {
  const id = randomUUID();
  db.insert(users)
    .values({
      id,
      telegramUserId: input.telegramUserId,
      telegramUsername: input.telegramUsername ?? null,
      displayName: input.displayName,
      photoUrl: input.photoUrl ?? null,
      role: input.role,
      isActive: true,
      locale: input.locale ?? null,
    })
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user creation failed');
  return row;
}

export async function getUserByTelegramId(db: Db, telegramUserId: number) {
  return db.select().from(users).where(eq(users.telegramUserId, telegramUserId)).get();
}

export async function getUserById(db: Db, id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function deactivateUser(db: Db, id: string) {
  const now = new Date().toISOString();
  db.update(users)
    .set({ isActive: false, deactivatedAt: now })
    .where(eq(users.id, id))
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}

export async function reactivateUser(db: Db, id: string) {
  db.update(users)
    .set({ isActive: true, deactivatedAt: null })
    .where(eq(users.id, id))
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}

export async function changeRole(db: Db, id: string, role: Role) {
  db.update(users).set({ role }).where(eq(users.id, id)).run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}

export async function listActiveMembers(db: Db) {
  return db.select().from(users).where(eq(users.isActive, true)).all();
}

export async function updateUserLocale(db: Db, id: string, locale: Locale) {
  db.update(users).set({ locale }).where(eq(users.id, id)).run();
}
