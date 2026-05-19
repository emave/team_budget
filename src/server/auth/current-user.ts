import 'server-only';
import type { Db } from '@/server/domain/types';
import { verifyCookie } from './session-cookie';
import { getSession } from '@/server/domain/sessions';
import { getUserById } from '@/server/domain/users';

export async function resolveCurrentUser(
  db: Db,
  cookieValue: string | undefined,
  secret: string,
) {
  if (!cookieValue) return null;
  const token = verifyCookie(cookieValue, secret);
  if (!token) return null;
  const session = await getSession(db, token);
  if (!session) return null;
  const user = await getUserById(db, session.userId);
  return user ?? null;
}
