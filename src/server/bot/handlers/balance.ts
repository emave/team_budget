import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { getNetBalance } from '@/server/domain/credit';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';

export async function runBalance(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  if (!ctx.currentUser) {
    await ctx.reply(m.bot.notMember);
    return;
  }
  const net = await getNetBalance(ctx.db, ctx.currentUser.id);
  await ctx.reply(m.bot.balanceLine(formatCents(net)));
}

export function registerBalanceHandler(bot: Bot<BotContext>) {
  bot.command('balance', runBalance);
}
