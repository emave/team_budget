import { desc, eq } from 'drizzle-orm';
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { charges, payments } from '@/server/db/schema';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';

export function registerHistoryHandler(bot: Bot<BotContext>) {
  bot.command('history', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
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
      ...myCharges.map((c) => ({ at: c.createdAt, line: `🧾 ${formatCents(c.amount, settings.currency)} — ${c.description} [${c.status}]` })),
      ...myPayments.map((p) => ({ at: p.createdAt, line: `💵 ${formatCents(p.amount, settings.currency)} (${p.method})${p.cancelledAt ? ' [cancelled]' : ''}` })),
    ].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 10);

    if (events.length === 0) {
      await ctx.reply('No recent activity.');
      return;
    }
    await ctx.reply(`📜 Recent activity:\n${events.map((e) => e.line).join('\n')}`);
  });
}
