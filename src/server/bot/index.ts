import 'server-only';
import { Bot } from 'grammy';
import { env } from '@/server/env';
import { getDb } from '@/server/db/client';
import { identifyUser, type BotContext } from './middleware';

let _bot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!_bot) {
    _bot = new Bot<BotContext>(env().BOT_TOKEN);
    _bot.use((ctx, next) => {
      ctx.db = getDb();
      return next();
    });
    _bot.use(identifyUser);
    // Command handlers are registered in subsequent tasks.
  }
  return _bot;
}

export async function startBot() {
  const bot = getBot();
  await bot.start({ drop_pending_updates: true });
}
