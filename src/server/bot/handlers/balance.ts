import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { listOpenChargesForMember, getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';

export function registerBalanceHandler(bot: Bot<BotContext>) {
  bot.command('balance', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    const settings = await getOrCreateSettings(ctx.db);
    const total = await getMemberOutstandingDebt(ctx.db, ctx.currentUser.id);
    if (total === 0) {
      await ctx.reply(m.bot.settledYes);
      return;
    }
    const charges = await listOpenChargesForMember(ctx.db, ctx.currentUser.id);
    const lines = charges.map((c) => m.bot.chargeBullet(formatCents(c.amount, settings.currency), c.description));
    await ctx.reply(`${m.bot.youOweTotal(formatCents(total, settings.currency))}\n${lines.join('\n')}`);
  });
}
