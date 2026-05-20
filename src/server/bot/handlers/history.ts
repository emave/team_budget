import { desc, eq } from 'drizzle-orm';
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { charges, payments } from '@/server/db/schema';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';

export function registerHistoryHandler(bot: Bot<BotContext>) {
  bot.command('history', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    const settings = await getOrCreateSettings(ctx.db);
    const myCharges = ctx.db
      .select()
      .from(charges)
      .where(eq(charges.userId, ctx.currentUser.id))
      .orderBy(desc(charges.createdAt))
      .limit(10)
      .all();
    const myPayments = ctx.db
      .select()
      .from(payments)
      .where(eq(payments.payerUserId, ctx.currentUser.id))
      .orderBy(desc(payments.createdAt))
      .limit(10)
      .all();

    const events = [
      ...myCharges.map((c) => ({
        at: c.createdAt,
        line: m.bot.historyChargeLine(formatCents(c.amount, settings.currency), c.description, c.status),
      })),
      ...myPayments.map((p) => ({
        at: p.createdAt,
        line: m.bot.historyPaymentLine(formatCents(p.amount, settings.currency), p.method, !!p.cancelledAt),
      })),
    ].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 10);

    if (events.length === 0) {
      await ctx.reply(m.bot.historyEmpty);
      return;
    }
    await ctx.reply(`${m.bot.historyHeading}\n${events.map((e) => e.line).join('\n')}`);
  });
}
