import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import { recordPayment, fifoAllocate } from '@/server/domain/payments';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberSubscriptionDebt } from '@/server/domain/charges';
import { getCreditBalance } from '@/server/domain/credit';
import { botMessages } from '../i18n';
import { getNotifier } from '../notifications';
import { detectFromTelegram, getMessages, isLocale } from '@/shared/i18n';
import { hydrateConversationCtx } from './hydrate';

export async function payConversation(conversation: BotConversation, ctx: BotContext) {
  await hydrateConversationCtx(ctx);
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;

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
  const payerName = members.find((mm) => mm.id === payerId)?.displayName ?? '?';

  // Step 2: subscription-debt branch vs deposit branch
  const subDebt = await getMemberSubscriptionDebt(ctx.db, payerId);
  let cents: number;
  let depositOnly = false;

  if (subDebt > 0) {
    await ctx.reply(m.bot.pay.subscriptionDebtPrompt(formatCents(subDebt)));
    const amountCtx = await conversation.waitFor('message:text');
    try {
      cents = parseDollarsToCents(amountCtx.message.text);
    } catch {
      await ctx.reply(m.bot.pay.invalidAmount);
      return;
    }
    if (cents > subDebt) {
      const excess = cents - subDebt;
      await ctx.reply(
        m.wallet.bot.payOverpaymentPrompt(formatCents(excess), payerName),
        {
          reply_markup: new InlineKeyboard()
            .text(m.wallet.bot.btnYes, 'pay:ov:y')
            .text(m.wallet.bot.btnNo, 'pay:ov:n'),
        },
      );
      const ovCtx = await conversation.waitForCallbackQuery(/^pay:ov:(y|n)$/);
      await ovCtx.answerCallbackQuery();
      if (ovCtx.match[1] !== 'y') {
        await ctx.reply(m.bot.pay.exceedsDebt(formatCents(subDebt)));
        return;
      }
    }
  } else {
    await ctx.reply(m.bot.pay.noSubscriptionDebtConfirm(payerName), {
      reply_markup: new InlineKeyboard()
        .text(m.wallet.bot.btnYes, 'pay:dep:y')
        .text(m.wallet.bot.btnNo, 'pay:dep:n'),
    });
    const depCtx = await conversation.waitForCallbackQuery(/^pay:dep:(y|n)$/);
    await depCtx.answerCallbackQuery();
    if (depCtx.match[1] !== 'y') {
      await ctx.reply(m.bot.pay.cancelled);
      return;
    }
    depositOnly = true;
    await ctx.reply(m.bot.pay.depositAmountPrompt);
    const amountCtx = await conversation.waitFor('message:text');
    try {
      cents = parseDollarsToCents(amountCtx.message.text);
    } catch {
      await ctx.reply(m.bot.pay.invalidAmount);
      return;
    }
  }

  // Step 3: method
  await ctx.reply(m.bot.pay.cashOrCard, {
    reply_markup: new InlineKeyboard().text(m.bot.pay.btnCash, 'pay:method:cash').text(m.bot.pay.btnCard, 'pay:method:card'),
  });
  const methodCtx = await conversation.waitForCallbackQuery(/^pay:method:(cash|card)$/);
  await methodCtx.answerCallbackQuery();
  const method = methodCtx.match[1] as 'cash' | 'card';

  // Step 4: FIFO allocate over monthly_dues only
  const allocations = depositOnly
    ? []
    : await fifoAllocate(ctx.db, payerId, cents, { chargeTypes: ['monthly_dues'] });

  // Step 5: record
  await recordPayment(ctx.db, {
    payerUserId: payerId,
    method,
    amount: cents,
    allocations,
    createdByUserId: adminId,
  });

  const formattedAmount = formatCents(cents);

  if (depositOnly) {
    const balance = await getCreditBalance(ctx.db, payerId);
    const formattedBalance = formatCents(balance);
    await ctx.reply(
      m.bot.pay.depositedToWallet(payerName, formattedAmount, formattedBalance),
    );
    try {
      await getNotifier().notifyUser(payerId, (recipient) => {
        const recipientLocale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
        return getMessages(recipientLocale).bot.pay.notifyDeposit(formattedAmount, method, formattedBalance);
      });
    } catch (err) {
      console.error('[pay] notify failed:', err);
    }
    return;
  }

  const remaining = await getMemberSubscriptionDebt(ctx.db, payerId);
  const formattedRemaining = formatCents(remaining);
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
