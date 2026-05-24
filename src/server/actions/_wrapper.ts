import 'server-only';
import { cookies } from 'next/headers';
import { getDb as defaultGetDb } from '@/server/db/client';
import { resolveCurrentUser } from '@/server/auth/current-user';
import type { Db } from '@/server/domain/types';
import type { users } from '@/server/db/schema';

export type CurrentUser = typeof users.$inferSelect;

export class ActionError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'BAD_INPUT' | 'INTERNAL', message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export interface ActionContext {
  user: CurrentUser;
  db: Db;
}

async function resolve(deps: { getDb: () => Db }): Promise<CurrentUser> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new ActionError('INTERNAL', 'SESSION_SECRET not configured');
  const cookie = (await cookies()).get('tb_session')?.value;
  const user = await resolveCurrentUser(deps.getDb(), cookie, secret);
  if (!user) throw new ActionError('UNAUTHENTICATED', 'sign in required');
  return user;
}

export function makeMemberAction(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  return function memberAction<TIn, TOut>(fn: (ctx: ActionContext, input: TIn) => Promise<TOut>) {
    return async (input: TIn) => {
      const user = await resolve(deps);
      return fn({ user, db: deps.getDb() }, input);
    };
  };
}

export function makeAdminAction(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  return function adminAction<TIn, TOut>(fn: (ctx: ActionContext, input: TIn) => Promise<TOut>) {
    return async (input: TIn) => {
      const user = await resolve(deps);
      if (user.role !== 'admin') throw new ActionError('FORBIDDEN', 'admin required');
      return fn({ user, db: deps.getDb() }, input);
    };
  };
}

// Production singletons
export const memberAction = makeMemberAction();
export const adminAction = makeAdminAction();
