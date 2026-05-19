import type { Context, SessionFlavor } from 'grammy';
import type { ConversationFlavor, Conversation } from '@grammyjs/conversations';
import type { Db } from '@/server/domain/types';
import type { users } from '@/server/db/schema';

export interface SessionData {}

export interface BotContextProps {
  db: Db;
  currentUser: typeof users.$inferSelect | null;
}

export type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor & BotContextProps;
export type BotConversation = Conversation<BotContext>;
