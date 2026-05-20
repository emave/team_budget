import 'server-only';
import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { eq } from 'drizzle-orm';
import { env } from '@/server/env';
import { getDb } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { getMessages, LOCALES, type Locale } from '@/shared/i18n';
import { identifyUser, type BotContext } from './middleware';
import { registerStartHandler } from './handlers/start';
import { registerHelpHandler } from './handlers/help';
import { registerMenuHandler } from './handlers/menu';
import { registerBalanceHandler } from './handlers/balance';
import { registerHistoryHandler } from './handlers/history';
import { registerInfoHandler } from './handlers/info';
import { registerInviteHandler } from './handlers/invite';
import { registerLanguageHandler } from './handlers/language';
import { registerTeamHandler } from './handlers/team';
import { spendConversation } from './conversations/spend';
import { payConversation } from './conversations/pay';
import { chargeConversation } from './conversations/charge';
import { infoEditConversation } from './conversations/info-edit';

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
    _bot.use(createConversation(chargeConversation, 'charge'));
    _bot.command('charge', async (ctx) => { await ctx.conversation.enter('charge'); });
    _bot.use(createConversation(infoEditConversation, 'infoEdit'));
    _bot.command('info_edit', async (ctx) => { await ctx.conversation.enter('infoEdit'); });
    registerStartHandler(_bot, { bootstrapAdminTelegramId: env().BOOTSTRAP_ADMIN_TELEGRAM_ID });
    registerHelpHandler(_bot);
    registerMenuHandler(_bot);
    registerBalanceHandler(_bot);
    registerHistoryHandler(_bot);
    registerInfoHandler(_bot);
    registerInviteHandler(_bot);
    registerLanguageHandler(_bot);
    registerTeamHandler(_bot);
  }
  return _bot;
}

function publicCommands(locale: Locale) {
  const d = getMessages(locale).bot.cmdDescriptions;
  return [
    { command: 'menu', description: d.menu },
    { command: 'balance', description: d.balance },
    { command: 'history', description: d.history },
    { command: 'info', description: d.info },
    { command: 'help', description: d.help },
    { command: 'language', description: d.language },
  ];
}

function adminCommands(locale: Locale) {
  const d = getMessages(locale).bot.cmdDescriptions;
  return [
    ...publicCommands(locale),
    { command: 'team', description: d.team },
    { command: 'spend', description: d.spend },
    { command: 'pay', description: d.pay },
    { command: 'charge', description: d.charge },
    { command: 'invite', description: d.invite },
    { command: 'info_edit', description: d.info_edit },
  ];
}

async function publishCommands(bot: Bot<BotContext>) {
  // Default scope uses English so unknown-locale users still get a sensible list.
  await bot.api.setMyCommands(publicCommands('en'));
  // Per-language overrides (Telegram supports per-language_code commands).
  for (const loc of LOCALES) {
    try {
      await bot.api.setMyCommands(publicCommands(loc), { language_code: loc });
    } catch (err) {
      console.error(`[bot] setMyCommands(${loc}) failed:`, err);
    }
  }
}

// Publishes the admin command list scoped to a single admin's private chat.
// Telegram requires per-chat scopes for per-user command overrides; we set it
// once globally for that chat (no language_code) and once per supported
// language so the right list shows regardless of the admin's Telegram UI lang.
export async function publishAdminCommandsForChat(bot: Bot<BotContext>, telegramUserId: number) {
  const scope = { type: 'chat' as const, chat_id: telegramUserId };
  try {
    await bot.api.setMyCommands(adminCommands('en'), { scope });
  } catch (err) {
    console.error(`[bot] setMyCommands(admin chat=${telegramUserId}) failed:`, err);
  }
  for (const loc of LOCALES) {
    try {
      await bot.api.setMyCommands(adminCommands(loc), { scope, language_code: loc });
    } catch (err) {
      console.error(`[bot] setMyCommands(admin chat=${telegramUserId}, ${loc}) failed:`, err);
    }
  }
}

export async function clearChatCommandsForChat(bot: Bot<BotContext>, telegramUserId: number) {
  const scope = { type: 'chat' as const, chat_id: telegramUserId };
  try {
    await bot.api.deleteMyCommands({ scope });
  } catch (err) {
    console.error(`[bot] deleteMyCommands(chat=${telegramUserId}) failed:`, err);
  }
  for (const loc of LOCALES) {
    try {
      await bot.api.deleteMyCommands({ scope, language_code: loc });
    } catch (err) {
      console.error(`[bot] deleteMyCommands(chat=${telegramUserId}, ${loc}) failed:`, err);
    }
  }
}

async function publishAdminCommandsForAllAdmins(bot: Bot<BotContext>) {
  const db = getDb();
  const admins = db.select().from(users).where(eq(users.role, 'admin')).all();
  for (const a of admins) {
    if (!a.isActive) continue;
    await publishAdminCommandsForChat(bot, a.telegramUserId);
  }
}

export async function startBot() {
  const bot = getBot();
  try { await publishCommands(bot); }
  catch (err) { console.error('[bot] publishCommands failed:', err); }
  try { await publishAdminCommandsForAllAdmins(bot); }
  catch (err) { console.error('[bot] publishAdminCommandsForAllAdmins failed:', err); }
  await bot.start({ drop_pending_updates: true });
}
