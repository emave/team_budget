import { desc, eq } from 'drizzle-orm';
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { charges, payments } from '@/server/db/schema';
import { listCreditHistory } from '@/server/domain/credit';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';

const MAX_EVENTS = 10;

export async function runHistory(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  if (!ctx.currentUser) {
    await ctx.reply(m.bot.notMember);
    return;
  }
  const userId = ctx.currentUser.id;

  const myCharges = ctx.db
    .select()
    .from(charges)
    .where(eq(charges.userId, userId))
    .orderBy(desc(charges.createdAt))
    .limit(MAX_EVENTS)
    .all();
  const myPayments = ctx.db
    .select()
    .from(payments)
    .where(eq(payments.payerUserId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(MAX_EVENTS)
    .all();
  const credit = await listCreditHistory(ctx.db, userId);

  type Row = { at: number; line: string };
  const toMs = (v: unknown): number => {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return new Date(v).getTime();
    return 0;
  };
  const rows: Row[] = [];

  for (const c of myCharges) {
    rows.push({
      at: toMs(c.createdAt),
      line: m.bot.historyChargeLine(formatCents(c.amount), c.description, c.status),
    });
  }
  for (const p of myPayments) {
    rows.push({
      at: toMs(p.createdAt),
      line: m.bot.historyPaymentLine(formatCents(p.amount), p.method, !!p.cancelledAt),
    });
  }
  for (const e of credit) {
    if (e.kind === 'payment_consumption') continue;
    const at = toMs(e.occurredAt);
    if (e.kind === 'payment_deposit') {
      const method = e.method === 'cash' ? m.common.cash : m.common.card;
      rows.push({ at, line: `💰 ${m.wallet.historyEvent.payment_deposit(formatCents(e.amount), method)}` });
    } else if (e.kind === 'refund') {
      const method = e.method === 'cash' ? m.common.cash : m.common.card;
      rows.push({ at, line: `↩️ ${m.wallet.historyEvent.refund(formatCents(e.amount), method)}` });
    } else if (e.kind === 'transfer_in') {
      rows.push({ at, line: `↘️ ${m.wallet.historyEvent.transfer_in(formatCents(e.amount), e.counterpartyDisplayName)}` });
    } else if (e.kind === 'transfer_out') {
      rows.push({ at, line: `↗️ ${m.wallet.historyEvent.transfer_out(formatCents(e.amount), e.counterpartyDisplayName)}` });
    }
  }

  const events = rows
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_EVENTS);

  if (events.length === 0) {
    await ctx.reply(m.bot.historyEmpty);
    return;
  }
  await ctx.reply(`${m.bot.historyHeading}\n${events.map((e) => e.line).join('\n')}`);
}

export function registerHistoryHandler(bot: Bot<BotContext>) {
  bot.command('history', runHistory);
}
