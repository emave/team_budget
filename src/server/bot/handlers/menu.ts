import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';

export function registerMenuHandler(bot: Bot<BotContext>) {
  bot.command('menu', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
      return;
    }
    const kb = new InlineKeyboard()
      .text('💰 Balance', 'menu:balance')
      .text('📜 History', 'menu:history')
      .row()
      .text('ℹ️ Info', 'menu:info');
    if (ctx.currentUser.role === 'admin') {
      kb.row().text('🔧 Admin menu', 'menu:admin');
    }
    await ctx.reply(`Main menu — ${ctx.currentUser.displayName}`, {
      reply_markup: kb,
    });
  });

  // Stub callbacks for now; real handlers come in Plan 3.
  bot.callbackQuery(/^menu:/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Coming soon.' });
  });
}
