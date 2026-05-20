import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { listInfoPages } from '@/server/domain/info-pages';
import { eq } from 'drizzle-orm';
import { infoPages } from '@/server/db/schema';
import { botMessages } from '../i18n';

export function registerInfoHandler(bot: Bot<BotContext>) {
  bot.command('info', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    const pages = await listInfoPages(ctx.db);
    if (pages.length === 0) {
      await ctx.reply(m.bot.infoNoEntries);
      return;
    }
    const kb = new InlineKeyboard();
    pages.forEach((p, i) => {
      kb.text(p.title.slice(0, 40), `info:${p.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    await ctx.reply(m.bot.infoTapEntry, { reply_markup: kb });
  });

  bot.callbackQuery(/^info:(.+)$/, async (ctx) => {
    const { m } = botMessages(ctx);
    const id = ctx.match[1];
    if (!id) {
      await ctx.answerCallbackQuery({ text: m.bot.infoInvalidRef });
      return;
    }
    const page = ctx.db.select().from(infoPages).where(eq(infoPages.id, id)).get();
    if (!page) {
      await ctx.answerCallbackQuery({ text: m.bot.infoNotFound });
      return;
    }
    await ctx.answerCallbackQuery();
    await ctx.reply(`*${page.title}*\n\n${page.body}`, { parse_mode: 'Markdown' });
  });
}
