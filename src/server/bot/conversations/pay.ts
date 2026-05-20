import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import { recordPayment, fifoAllocate } from '@/server/domain/payments';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { botMessages } from '../i18n';
import { getNotifier } from '../notifications';
import { detectFromTelegram, getMessages, isLocale } from '@/shared/i18n';

export async function payConversation(conversation: BotConversation, ctx: BotContext) {
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;
  const settings = await getOrCreateSettings(ctx.db);

  // Step 1: payer
  const members = await listActiveMembers(ctx.db);
  if (members.length === 0) {
    await ctx.reply(m.bot.pay.noActiveMembers);
    return;
  }
  const memberKb = new InlineKeyboard();
  members.forEach((mm, i) => {
    memberKb.text(mm.displayName, `pay:m:${mm.id}`);
    if ((i + 1) % 2 === 0) memberKb.row();
  });
  await ctx.reply(m.bot.pay.whoPaid, { reply_markup: memberKb });
  const memCtx = await conversation.waitForCallbackQuery(/^pay:m:(.+)$/);
  await memCtx.answerCallbackQuery();
  const payerId = memCtx.match[1]!;

  // Step 2: amount
  const debt = await getMemberOutstandingDebt(ctx.db, payerId);
  if (debt === 0) {
    await ctx.reply(m.bot.pay.settledAborted);
    return;
  }
  await ctx.reply(m.bot.pay.owesAmountPrompt(formatCents(debt, settings.currency)));
  const amountCtx = await conversation.waitFor('message:text');
  let cents: number;
  try {
    cents = parseDollarsToCents(amountCtx.message.text);
  } catch {
    await ctx.reply(m.bot.pay.invalidAmount);
    return;
  }
  if (cents > debt) {
    await ctx.reply(m.bot.pay.exceedsDebt(formatCents(debt, settings.currency)));
    return;
  }

  // Step 3: method
  await ctx.reply(m.bot.pay.cashOrCard, {
    reply_markup: new InlineKeyboard().text(m.bot.pay.btnCash, 'pay:method:cash').text(m.bot.pay.btnCard, 'pay:method:card'),
  });
  const methodCtx = await conversation.waitForCallbackQuery(/^pay:method:(cash|card)$/);
  await methodCtx.answerCallbackQuery();
  const method = methodCtx.match[1] as 'cash' | 'card';

  // Step 4: FIFO allocate
  const allocations = await fifoAllocate(ctx.db, payerId, cents);

  // Step 5: record
  await recordPayment(ctx.db, {
    payerUserId: payerId,
    method,
    amount: cents,
    allocations,
    createdByUserId: adminId,
  });

  const remaining = debt - cents;
  const formattedAmount = formatCents(cents, settings.currency);
  const formattedRemaining = formatCents(remaining, settings.currency);
  await ctx.reply(m.bot.pay.recorded(method, formattedAmount, formattedRemaining));
  try {
    await getNotifier().notifyUser(payerId, (recipient) => {
      const recipientLocale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
      return getMessages(recipientLocale).bot.pay.notifyPaid(formattedAmount, method, formattedRemaining);
    });
  } catch (err) {
    console.error('[pay] notify failed:', err);
  }
}
