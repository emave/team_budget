import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { botMessages } from '../i18n';

export function registerHelpHandler(bot: Bot<BotContext>) {
  bot.command('help', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.reply(m.bot.helpText);
  });
}
