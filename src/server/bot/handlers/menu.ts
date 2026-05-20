import { type Bot } from 'grammy';
import type { InlineKeyboardButton } from 'grammy/types';
import type { BotContext } from '../middleware';
import { env } from '@/server/env';
import { botMessages } from '../i18n';

export function registerMenuHandler(bot: Bot<BotContext>) {
  bot.command('menu', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    const baseUrl = env().NEXT_PUBLIC_BASE_URL;
    const buttons: InlineKeyboardButton[][] = [
      [{ text: m.bot.menuBtnBalance, callback_data: 'menu:balance' }, { text: m.bot.menuBtnHistory, callback_data: 'menu:history' }],
      [{ text: m.bot.menuBtnInfo, callback_data: 'menu:info' }],
      [{ text: m.bot.menuBtnOpenMini, web_app: { url: `${baseUrl}/mini` } }],
    ];
    if (ctx.currentUser.role === 'admin') {
      buttons.push(
        [{ text: m.bot.menuBtnNewCharge, callback_data: 'menu:charge' }, { text: m.bot.menuBtnRecordPayment, callback_data: 'menu:pay' }],
        [{ text: m.bot.menuBtnRecordSpending, callback_data: 'menu:spend' }, { text: m.bot.menuBtnInvite, callback_data: 'menu:invite' }],
      );
    }
    await ctx.reply(m.bot.menuTitle(ctx.currentUser.displayName), {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.callbackQuery('menu:balance', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (!ctx.currentUser) return;
    const { getMemberOutstandingDebt, listOpenChargesForMember } = await import('@/server/domain/charges');
    const { getOrCreateSettings } = await import('@/server/domain/settings');
    const { formatCents } = await import('@/shared/format');
    const s = await getOrCreateSettings(ctx.db);
    const total = await getMemberOutstandingDebt(ctx.db, ctx.currentUser.id);
    if (total === 0) { await ctx.reply(m.bot.settledYes); return; }
    const cs = await listOpenChargesForMember(ctx.db, ctx.currentUser.id);
    const lines = cs.map((c) => m.bot.chargeBullet(formatCents(c.amount, s.currency), c.description));
    await ctx.reply(`${m.bot.youOweTotal(formatCents(total, s.currency))}\n${lines.join('\n')}`);
  });

  bot.callbackQuery('menu:history', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery({ text: m.bot.menuTypeHistory });
  });

  bot.callbackQuery('menu:info', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery({ text: m.bot.menuTypeInfo });
  });

  bot.callbackQuery('menu:charge', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('charge');
  });
  bot.callbackQuery('menu:pay', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('pay');
  });
  bot.callbackQuery('menu:spend', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('spend');
  });
  bot.callbackQuery('menu:invite', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    const { createInvite } = await import('@/server/domain/invites');
    const inv = await createInvite(ctx.db, { createdByUserId: ctx.currentUser.id });
    await ctx.reply(m.bot.inviteFromMenu(`https://t.me/${env().BOT_USERNAME}?start=invite_${inv.token}`));
  });
}
