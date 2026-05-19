import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { listOpenChargesForMember, getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';

export function registerBalanceHandler(bot: Bot<BotContext>) {
  bot.command('balance', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
      return;
    }
    const settings = await getOrCreateSettings(ctx.db);
    const total = await getMemberOutstandingDebt(ctx.db, ctx.currentUser.id);
    if (total === 0) {
      await ctx.reply('✅ You are settled.');
      return;
    }
    const charges = await listOpenChargesForMember(ctx.db, ctx.currentUser.id);
    const lines = charges.map((c) => `  • ${formatCents(c.amount, settings.currency)} — ${c.description}`);
    await ctx.reply(`💰 You owe ${formatCents(total, settings.currency)}:\n${lines.join('\n')}`);
  });
}
