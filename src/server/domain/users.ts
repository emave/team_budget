import { eq, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  users,
  charges,
  payments,
  spendings,
  infoPages,
  invites,
} from '@/server/db/schema';
import type { Locale } from '@/shared/i18n';
import type { Db } from './types';

export type Role = 'admin' | 'member';

export type DeleteBlockReason = 'has_financial_history' | 'has_invites';

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

export async function updateUserProfile(
  db: Db,
  id: string,
  patch: { displayName: string; role: Role },
) {
  db.update(users)
    .set({ displayName: patch.displayName, role: patch.role })
    .where(eq(users.id, id))
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}

export async function canHardDeleteUser(
  db: Db,
  id: string,
): Promise<DeleteBlockReason | null> {
  const hasCharge = db
    .select({ id: charges.id })
    .from(charges)
    .where(or(eq(charges.userId, id), eq(charges.createdByUserId, id)))
    .limit(1)
    .get();
  if (hasCharge) return 'has_financial_history';

  const hasPayment = db
    .select({ id: payments.id })
    .from(payments)
    .where(or(eq(payments.payerUserId, id), eq(payments.createdByUserId, id)))
    .limit(1)
    .get();
  if (hasPayment) return 'has_financial_history';

  const hasSpending = db
    .select({ id: spendings.id })
    .from(spendings)
    .where(eq(spendings.createdByUserId, id))
    .limit(1)
    .get();
  if (hasSpending) return 'has_financial_history';

  const hasInfoPage = db
    .select({ id: infoPages.id })
    .from(infoPages)
    .where(eq(infoPages.updatedByUserId, id))
    .limit(1)
    .get();
  if (hasInfoPage) return 'has_financial_history';

  const hasInvite = db
    .select({ id: invites.id })
    .from(invites)
    .where(or(eq(invites.createdByUserId, id), eq(invites.consumedByUserId, id)))
    .limit(1)
    .get();
  if (hasInvite) return 'has_invites';

  return null;
}

export async function listActiveMembers(db: Db) {
  return db.select().from(users).where(eq(users.isActive, true)).all();
}

export async function updateUserLocale(db: Db, id: string, locale: Locale) {
  db.update(users).set({ locale }).where(eq(users.id, id)).run();
}
