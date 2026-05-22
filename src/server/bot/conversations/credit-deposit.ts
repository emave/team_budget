import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import { listActiveMembers } from '@/server/domain/users';
import { recordCreditDeposit, getCreditBalance } from '@/server/domain/credit';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { botMessages } from '../i18n';
import { hydrateConversationCtx } from './hydrate';

export async function creditDepositConversation(
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

  const members = await listActiveMembers(ctx.db);
  if (members.length === 0) {
    await ctx.reply(m.bot.pay.noActiveMembers);
    return;
  }
  const memberKb = new InlineKeyboard();
  members.forEach((mm, i) => {
    memberKb.text(mm.displayName, `dep:m:${mm.id}`);
    if ((i + 1) % 2 === 0) memberKb.row();
  });
  await ctx.reply(m.wallet.bot.depositPick, { reply_markup: memberKb });
  const memCtx = await conversation.waitForCallbackQuery(/^dep:m:(.+)$/);
  await memCtx.answerCallbackQuery();
  const targetId = memCtx.match[1]!;
  const targetName = members.find((mm) => mm.id === targetId)?.displayName ?? '?';

  await ctx.reply(m.wallet.bot.depositAmount);
  const amtCtx = await conversation.waitFor('message:text');
  let cents: number;
  try {
    cents = parseDollarsToCents(amtCtx.message.text);
  } catch {
    await ctx.reply(m.bot.pay.invalidAmount);
    return;
  }

  await ctx.reply(m.wallet.bot.depositMethod, {
    reply_markup: new InlineKeyboard()
      .text(m.common.cash, 'dep:method:cash')
      .text(m.common.card, 'dep:method:card'),
  });
  const methodCtx = await conversation.waitForCallbackQuery(/^dep:method:(cash|card)$/);
  await methodCtx.answerCallbackQuery();
  const method = methodCtx.match[1] as 'cash' | 'card';

  await ctx.reply(m.wallet.bot.depositNote);
  const noteCtx = await conversation.waitFor('message:text');
  const noteText = noteCtx.message.text.trim();
  const note = noteText === '/skip' ? undefined : noteText;

  await ctx.reply(m.wallet.bot.depositConfirm(targetName, formatCents(cents), method), {
    reply_markup: new InlineKeyboard()
      .text(m.wallet.bot.btnYes, 'dep:c:y')
      .text(m.wallet.bot.btnNo, 'dep:c:n'),
  });
  const confirmCtx = await conversation.waitForCallbackQuery(/^dep:c:(y|n)$/);
  await confirmCtx.answerCallbackQuery();
  if (confirmCtx.match[1] !== 'y') {
    await ctx.reply(m.bot.guestDeposit.cancelled);
    return;
  }

  await recordCreditDeposit(ctx.db, {
    payerUserId: targetId,
    method,
    amount: cents,
    note,
    createdByUserId: adminId,
  });
  const newBalance = await getCreditBalance(ctx.db, targetId);
  await ctx.reply(
    m.wallet.bot.depositDone(targetName, formatCents(cents), formatCents(newBalance)),
  );
}
