import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { getMessages, type Locale } from '@/shared/i18n';
import { updateUserLocale } from '@/server/domain/users';
import { botMessages } from '../i18n';

export function registerLanguageHandler(bot: Bot<BotContext>) {
  bot.command('language', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    await ctx.reply(m.bot.language.prompt, {
      reply_markup: new InlineKeyboard()
        .text(m.bot.language.btnEnglish, 'lang:set:en')
        .text(m.bot.language.btnRussian, 'lang:set:ru'),
    });
  });

  bot.callbackQuery(/^lang:set:(en|ru)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.currentUser) {
      const { m } = botMessages(ctx);
      await ctx.reply(m.bot.notMember);
      return;
    }
    const next = ctx.match[1] as Locale;
    await updateUserLocale(ctx.db, ctx.currentUser.id, next);
    ctx.currentUser = { ...ctx.currentUser, locale: next };
    const nm = getMessages(next);
    await ctx.reply(next === 'ru' ? nm.bot.language.switchedToRu : nm.bot.language.switchedToEn);
  });
}
