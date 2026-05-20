import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { invites } from '@/server/db/schema';
import type { Db } from './types';

export interface CreateInviteInput {
  createdByUserId: string;
  displayNameHint?: string | null;
}

export async function createInvite(db: Db, input: CreateInviteInput) {
  const id = randomUUID();
  const token = randomBytes(16).toString('base64url');
  db.insert(invites)
    .values({
      id,
      token,
      createdByUserId: input.createdByUserId,
      displayNameHint: input.displayNameHint ?? null,
    })
    .run();
  const row = db.select().from(invites).where(eq(invites.id, id)).get();
  if (!row) throw new Error('invite creation failed');
  return row;
}

export async function findOpenInviteByToken(db: Db, token: string) {
  return db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.token, token),
        isNull(invites.consumedByUserId),
        isNull(invites.revokedAt),
      ),
    )
    .get();
}

export async function listPendingInvites(db: Db) {
  return db
    .select()
    .from(invites)
    .where(and(isNull(invites.consumedByUserId), isNull(invites.revokedAt)))
    .orderBy(desc(invites.createdAt))
    .all();
}

export async function revokeInvite(db: Db, id: string) {
  const row = db.select().from(invites).where(eq(invites.id, id)).get();
  if (!row) throw new Error('invite not found');
  if (row.consumedByUserId) throw new Error('invite already consumed');
  if (row.revokedAt) return row;
  const now = new Date().toISOString();
  db.update(invites).set({ revokedAt: now }).where(eq(invites.id, id)).run();
  const after = db.select().from(invites).where(eq(invites.id, id)).get();
  if (!after) throw new Error('invite vanished after revoke');
  return after;
}

export async function consumeInvite(db: Db, token: string, consumedByUserId: string) {
  const open = await findOpenInviteByToken(db, token);
  if (!open) throw new Error('invite not found or already consumed');
  const now = new Date().toISOString();
  db.update(invites)
    .set({ consumedByUserId, consumedAt: now })
    .where(eq(invites.id, open.id))
    .run();
  const row = db.select().from(invites).where(eq(invites.id, open.id)).get();
  if (!row) throw new Error('invite vanished after consume');
  return row;
}
