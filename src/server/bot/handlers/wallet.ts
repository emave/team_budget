import type { Bot } from 'grammy';
import type { BotContext } from '../context';
import { getCreditBalance, listCreditHistory } from '@/server/domain/credit';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';

export function registerWalletHandler(bot: Bot<BotContext>) {
  bot.command('wallet', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    const balance = await getCreditBalance(ctx.db, ctx.currentUser.id);
    if (balance === 0) {
      await ctx.reply(m.wallet.bot.walletEmpty);
      return;
    }
    const history = (await listCreditHistory(ctx.db, ctx.currentUser.id)).slice(0, 5);
    const lines: string[] = [m.wallet.bot.walletHeading(formatCents(balance)), ''];
    for (const e of history) {
      if (e.kind === 'payment_deposit') {
        lines.push(
          `• ${m.wallet.historyEvent.payment_deposit(
            formatCents(e.amount),
            e.method === 'cash' ? m.common.cash : m.common.card,
          )}`,
        );
      } else if (e.kind === 'payment_consumption') {
        lines.push(
          `• ${m.wallet.historyEvent.payment_consumption(formatCents(e.amount), e.chargeDescription)}`,
        );
      } else if (e.kind === 'refund') {
        lines.push(
          `• ${m.wallet.historyEvent.refund(
            formatCents(e.amount),
            e.method === 'cash' ? m.common.cash : m.common.card,
          )}`,
        );
      } else if (e.kind === 'transfer_in') {
        lines.push(
          `• ${m.wallet.historyEvent.transfer_in(formatCents(e.amount), e.counterpartyDisplayName)}`,
        );
      } else if (e.kind === 'transfer_out') {
        lines.push(
          `• ${m.wallet.historyEvent.transfer_out(formatCents(e.amount), e.counterpartyDisplayName)}`,
        );
      }
    }
    await ctx.reply(lines.join('\n'));
  });
}
