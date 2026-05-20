import 'server-only';
import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { env } from '@/server/env';
import { getDb } from '@/server/db/client';
import { identifyUser, type BotContext } from './middleware';
import { registerStartHandler } from './handlers/start';
import { registerHelpHandler } from './handlers/help';
import { registerMenuHandler } from './handlers/menu';
import { registerBalanceHandler } from './handlers/balance';
import { registerHistoryHandler } from './handlers/history';
import { registerInfoHandler } from './handlers/info';
import { registerInviteHandler } from './handlers/invite';
import { spendConversation } from './conversations/spend';
import { payConversation } from './conversations/pay';

let _bot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!_bot) {
    _bot = new Bot<BotContext>(env().BOT_TOKEN);
    _bot.use(session({ initial: () => ({}) }));
    _bot.use(conversations());
    _bot.use((ctx, next) => {
      ctx.db = getDb();
      return next();
    });
    _bot.use(identifyUser);
    _bot.use(createConversation(spendConversation, 'spend'));
    _bot.command('spend', async (ctx) => { await ctx.conversation.enter('spend'); });
    _bot.use(createConversation(payConversation, 'pay'));
    _bot.command('pay', async (ctx) => { await ctx.conversation.enter('pay'); });
    registerStartHandler(_bot, { bootstrapAdminTelegramId: env().BOOTSTRAP_ADMIN_TELEGRAM_ID });
    registerHelpHandler(_bot);
    registerMenuHandler(_bot);
    registerBalanceHandler(_bot);
    registerHistoryHandler(_bot);
    registerInfoHandler(_bot);
    registerInviteHandler(_bot);
  }
  return _bot;
}

export async function startBot() {
  const bot = getBot();
  await bot.start({ drop_pending_updates: true });
}
