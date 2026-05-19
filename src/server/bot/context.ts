import type { Context } from 'grammy';
import type { Db } from '@/server/domain/types';
import type { users } from '@/server/db/schema';

export interface BotContextProps {
  db: Db;
  currentUser: typeof users.$inferSelect | null;
}

export type BotContext = Context & BotContextProps;
