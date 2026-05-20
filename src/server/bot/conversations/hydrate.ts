import 'server-only';
import { getDb } from '@/server/db/client';
import { getUserByTelegramId } from '@/server/domain/users';
import type { BotContext } from '../context';

// `@grammyjs/conversations` v2 constructs a fresh grammy Context for the
// conversation function (only `update`, `api`, `me`), so custom properties
// set by outer middleware (`ctx.db`, `ctx.currentUser`) are absent. We
// rehydrate them here on every conversation entry/replay.
export async function hydrateConversationCtx(ctx: BotContext): Promise<void> {
  ctx.db = getDb();
  const tgId = ctx.from?.id;
  ctx.currentUser = tgId ? (await getUserByTelegramId(ctx.db, tgId)) ?? null : null;
}
