import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import { recordPayment, fifoAllocate } from '@/server/domain/payments';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { getNotifier } from '../notifications';

export async function payConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;
  const settings = await getOrCreateSettings(ctx.db);

  // Step 1: payer
  const members = await listActiveMembers(ctx.db);
  if (members.length === 0) {
    await ctx.reply('No active members.');
    return;
  }
  const memberKb = new InlineKeyboard();
  members.forEach((m, i) => {
    memberKb.text(m.displayName, `pay:m:${m.id}`);
    if ((i + 1) % 2 === 0) memberKb.row();
  });
  await ctx.reply('Who paid?', { reply_markup: memberKb });
  const memCtx = await conversation.waitForCallbackQuery(/^pay:m:(.+)$/);
  await memCtx.answerCallbackQuery();
  const payerId = memCtx.match[1]!;

  // Step 2: amount
  const debt = await getMemberOutstandingDebt(ctx.db, payerId);
  if (debt === 0) {
    await ctx.reply('That member is settled. Aborted.');
    return;
  }
  await ctx.reply(`They owe ${formatCents(debt, settings.currency)}. Amount paid?`);
  const amountCtx = await conversation.waitFor('message:text');
  let cents: number;
  try {
    cents = parseDollarsToCents(amountCtx.message.text);
  } catch {
    await ctx.reply('Invalid amount. Aborted.');
    return;
  }
  if (cents > debt) {
    await ctx.reply(`Amount exceeds outstanding debt (${formatCents(debt, settings.currency)}). Aborted.`);
    return;
  }

  // Step 3: method
  await ctx.reply('Cash or card?', {
    reply_markup: new InlineKeyboard().text('💵 Cash', 'pay:method:cash').text('💳 Card', 'pay:method:card'),
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
  await ctx.reply(
    `✅ Recorded ${method} payment of ${formatCents(cents, settings.currency)}. Remaining: ${formatCents(remaining, settings.currency)}.`,
  );
  try {
    await getNotifier().notifyUser(
      payerId,
      `💵 Payment ${formatCents(cents, settings.currency)} (${method}) recorded. Remaining: ${formatCents(remaining, settings.currency)}.`,
    );
  } catch (err) {
    console.error('[pay] notify failed:', err);
  }
}
