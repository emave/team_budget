import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import { getUserById } from '@/server/domain/users';
import { listMemberCreditBalances, refundCredit, getCreditBalance } from '@/server/domain/credit';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { botMessages } from '../i18n';
import { hydrateConversationCtx } from './hydrate';

export async function creditRefundConversation(
  conversation: BotConversation,
  ctx: BotContext,
) {
  await hydrateConversationCtx(ctx);
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;

  const credits = (await listMemberCreditBalances(ctx.db)).filter((c) => c.balance > 0);
  if (credits.length === 0) {
    await ctx.reply(m.wallet.bot.refundNoneAvailable);
    return;
  }
  const userNames = new Map<string, string>();
  for (const c of credits) {
    const u = await getUserById(ctx.db, c.userId);
    if (u) userNames.set(c.userId, u.displayName);
  }
  const kb = new InlineKeyboard();
  credits.forEach((c, i) => {
    const name = userNames.get(c.userId) ?? '?';
    kb.text(`${name} (${formatCents(c.balance)})`, `ref:m:${c.userId}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  await ctx.reply(m.wallet.bot.refundPick, { reply_markup: kb });
  const memCtx = await conversation.waitForCallbackQuery(/^ref:m:(.+)$/);
  await memCtx.answerCallbackQuery();
  const targetId = memCtx.match[1]!;
  const targetName = userNames.get(targetId) ?? '?';

  await ctx.reply(m.wallet.bot.refundAmount);
  const amtCtx = await conversation.waitFor('message:text');
  let cents: number;
  try {
    cents = parseDollarsToCents(amtCtx.message.text);
  } catch {
    await ctx.reply(m.bot.pay.invalidAmount);
    return;
  }
  const balance = await getCreditBalance(ctx.db, targetId);
  if (cents > balance) {
    await ctx.reply(m.bot.pay.exceedsDebt(formatCents(balance)));
    return;
  }

  await ctx.reply(m.wallet.bot.refundMethod, {
    reply_markup: new InlineKeyboard()
      .text(m.common.cash, 'ref:method:cash')
      .text(m.common.card, 'ref:method:card'),
  });
  const methodCtx = await conversation.waitForCallbackQuery(/^ref:method:(cash|card)$/);
  await methodCtx.answerCallbackQuery();
  const method = methodCtx.match[1] as 'cash' | 'card';

  await ctx.reply(m.wallet.bot.refundNote);
  const noteCtx = await conversation.waitFor('message:text');
  const noteText = noteCtx.message.text.trim();
  const note = noteText === '/skip' ? undefined : noteText;

  await ctx.reply(m.wallet.bot.refundConfirm(targetName, formatCents(cents), method), {
    reply_markup: new InlineKeyboard()
      .text(m.wallet.bot.btnYes, 'ref:c:y')
      .text(m.wallet.bot.btnNo, 'ref:c:n'),
  });
  const confirmCtx = await conversation.waitForCallbackQuery(/^ref:c:(y|n)$/);
  await confirmCtx.answerCallbackQuery();
  if (confirmCtx.match[1] !== 'y') {
    await ctx.reply(m.bot.guestDeposit.cancelled);
    return;
  }

  await refundCredit(ctx.db, {
    userId: targetId,
    method,
    amount: cents,
    note,
    createdByUserId: adminId,
  });
  const newBalance = await getCreditBalance(ctx.db, targetId);
  await ctx.reply(
    m.wallet.bot.refundDone(targetName, formatCents(cents), formatCents(newBalance)),
  );
}
