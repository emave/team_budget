import { InlineKeyboard, type Bot } from 'grammy';
import type { InlineKeyboardButton } from 'grammy/types';
import type { BotContext } from '../middleware';
import { env } from '@/server/env';

export function registerMenuHandler(bot: Bot<BotContext>) {
  bot.command('menu', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
      return;
    }
    const baseUrl = env().NEXT_PUBLIC_BASE_URL;
    const buttons: InlineKeyboardButton[][] = [
      [{ text: '💰 Balance', callback_data: 'menu:balance' }, { text: '📜 History', callback_data: 'menu:history' }],
      [{ text: 'ℹ️ Info', callback_data: 'menu:info' }],
      [{ text: '📱 Open mini app', web_app: { url: `${baseUrl}/mini` } }],
    ];
    if (ctx.currentUser.role === 'admin') {
      buttons.push(
        [{ text: '🔧 New charge', callback_data: 'menu:charge' }, { text: '💵 Record payment', callback_data: 'menu:pay' }],
        [{ text: '🛒 Record spending', callback_data: 'menu:spend' }, { text: '🔗 Invite', callback_data: 'menu:invite' }],
      );
    }
    await ctx.reply(`Main menu — ${ctx.currentUser.displayName}`, {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.callbackQuery('menu:balance', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.currentUser) return;
    const { getMemberOutstandingDebt, listOpenChargesForMember } = await import('@/server/domain/charges');
    const { getOrCreateSettings } = await import('@/server/domain/settings');
    const { formatCents } = await import('@/shared/format');
    const s = await getOrCreateSettings(ctx.db);
    const total = await getMemberOutstandingDebt(ctx.db, ctx.currentUser.id);
    if (total === 0) { await ctx.reply('✅ You are settled.'); return; }
    const cs = await listOpenChargesForMember(ctx.db, ctx.currentUser.id);
    const lines = cs.map((c) => `  • ${formatCents(c.amount, s.currency)} — ${c.description}`);
    await ctx.reply(`💰 You owe ${formatCents(total, s.currency)}:\n${lines.join('\n')}`);
  });

  bot.callbackQuery('menu:history', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Type /history to see your activity.' });
  });

  bot.callbackQuery('menu:info', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Type /info to browse entries.' });
  });

  bot.callbackQuery('menu:charge', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    await ctx.conversation.enter('charge');
  });
  bot.callbackQuery('menu:pay', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    await ctx.conversation.enter('pay');
  });
  bot.callbackQuery('menu:spend', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    await ctx.conversation.enter('spend');
  });
  bot.callbackQuery('menu:invite', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    const { createInvite } = await import('@/server/domain/invites');
    const inv = await createInvite(ctx.db, { createdByUserId: ctx.currentUser.id });
    await ctx.reply(`✅ Invite link:\nhttps://t.me/${env().BOT_USERNAME}?start=invite_${inv.token}`);
  });
}
