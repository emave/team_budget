import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { botMessages } from '../i18n';

export async function runHelp(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  await ctx.reply(m.bot.helpText);
}

export function registerHelpHandler(bot: Bot<BotContext>) {
  bot.command('help', runHelp);
}
