import 'server-only';
import { getBot, publishAdminCommandsForChat, clearChatCommandsForChat } from './index';
import type { users } from '@/server/db/schema';

type UserRow = typeof users.$inferSelect;

// Keeps Telegram's per-chat command list in sync with a user's current role
// and active status. Promotion or reactivation publishes the admin command
// set to that user's private chat; demotion or deactivation reverts to the
// default scope. Failures are swallowed so they don't break the originating
// action — Telegram command lists are eventually consistent.
export async function syncAdminCommandsForUser(user: Pick<UserRow, 'telegramUserId' | 'role' | 'isActive'>): Promise<void> {
  // Skip silently when BOT_TOKEN isn't configured (tests, local dev without bot).
  if (!process.env.BOT_TOKEN) return;
  try {
    const bot = getBot();
    if (user.role === 'admin' && user.isActive) {
      await publishAdminCommandsForChat(bot, user.telegramUserId);
    } else {
      await clearChatCommandsForChat(bot, user.telegramUserId);
    }
  } catch (err) {
    console.error('[bot] syncAdminCommandsForUser failed:', err);
  }
}
