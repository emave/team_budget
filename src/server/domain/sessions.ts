import { eq, gt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { sessions } from '@/server/db/schema';
import type { Db } from './types';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: Db,
  userId: string,
  opts: { ttlMs?: number } = {},
) {
  const token = randomBytes(32).toString('hex');
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  db.insert(sessions).values({ token, userId, expiresAt }).run();
  return { token, userId, expiresAt };
}

export async function getSession(db: Db, token: string) {
  const now = new Date().toISOString();
  const row = db.select().from(sessions).where(eq(sessions.token, token)).get();
  return row && row.expiresAt > now ? row : undefined;
}

export async function refreshSession(db: Db, token: string) {
  const row = await getSession(db, token);
  if (!row) return undefined;
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS).toISOString();
  db.update(sessions).set({ expiresAt }).where(eq(sessions.token, token)).run();
  return { ...row, expiresAt };
}

export async function deleteSession(db: Db, token: string) {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

export async function pruneExpiredSessions(db: Db) {
  const now = new Date().toISOString();
  db.delete(sessions).where(gt(sessions.expiresAt, now)).run();
}
