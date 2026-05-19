import { and, eq, isNull } from 'drizzle-orm';
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
    .where(and(eq(invites.token, token), isNull(invites.consumedByUserId)))
    .get();
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
