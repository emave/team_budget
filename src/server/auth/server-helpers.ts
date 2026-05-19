import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/server/env';
import { getDb } from '@/server/db/client';
import { resolveCurrentUser } from './current-user';

export async function getCurrentUser() {
  const c = cookies().get('tb_session')?.value;
  return resolveCurrentUser(getDb(), c, env().SESSION_SECRET);
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== 'admin') redirect('/');
  return u;
}
