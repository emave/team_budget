import { InlineKeyboard } from 'grammy';
import { eq, max } from 'drizzle-orm';
import type { BotContext, BotConversation } from '../context';
import { guests as guestsTbl, guestDeposits } from '@/server/db/schema';
import { recordGuestDeposit } from '@/server/domain/guest-deposits';
import { createGuest, getGuest } from '@/server/domain/guests';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { botMessages } from '../i18n';
import { hydrateConversationCtx } from './hydrate';

export async function guestDepositConversation(conversation: BotConversation, ctx: BotContext) {
  await hydrateConversationCtx(ctx);
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;

  // 1. amount
  await ctx.reply(m.bot.guestDeposit.amountPrompt);
  const amtCtx = await conversation.waitFor('message:text');
  let cents: number;
  try {
    cents = parseDollarsToCents(amtCtx.message.text);
  } catch {
    await ctx.reply(m.bot.guestDeposit.invalidAmount);
    return;
  }

  // 2. method
  await ctx.reply(m.bot.guestDeposit.methodPrompt, {
    reply_markup: new InlineKeyboard()
      .text(m.bot.guestDeposit.btnCash, 'gd:method:cash')
      .text(m.bot.guestDeposit.btnCard, 'gd:method:card'),
  });
  const methodCtx = await conversation.waitForCallbackQuery(/^gd:method:(cash|card)$/);
  await methodCtx.answerCallbackQuery();
  const method = methodCtx.match[1] as 'cash' | 'card';

  // 3. guest selection — recent first by max(receivedAt)
  const recent = ctx.db
    .select({
      id: guestsTbl.id,
      name: guestsTbl.name,
      last: max(guestDeposits.receivedAt).as('last'),
    })
    .from(guestsTbl)
    .leftJoin(guestDeposits, eq(guestDeposits.guestId, guestsTbl.id))
    .where(eq(guestsTbl.archived, false))
    .groupBy(guestsTbl.id)
    .all()
    .sort((a, b) => ((b.last ?? '') > (a.last ?? '') ? 1 : -1))
    .slice(0, 8);

  const kb = new InlineKeyboard();
  recent.forEach((g, i) => {
    kb.text(g.name, `gd:g:${g.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  if (recent.length % 2 === 1) kb.row();
  kb.text(m.bot.guestDeposit.btnAnonymous, 'gd:g:__anon__').row();
  kb.text(m.bot.guestDeposit.btnNew, 'gd:g:__new__');
  kb.text(m.bot.guestDeposit.btnCancel, 'gd:g:__cancel__');

  await ctx.reply(m.bot.guestDeposit.whoPrompt, { reply_markup: kb });
  const gCtx = await conversation.waitForCallbackQuery(/^gd:g:(.+)$/);
  await gCtx.answerCallbackQuery();
  const choice = gCtx.match[1]!;

  let guestId: string | null = null;
  let guestName: string = m.bot.guestDeposit.btnAnonymous;
  if (choice === '__cancel__') {
    await ctx.reply(m.bot.guestDeposit.cancelled);
    return;
  } else if (choice === '__anon__') {
    guestId = null;
    guestName = m.bot.guestDeposit.btnAnonymous;
  } else if (choice === '__new__') {
    await ctx.reply(m.bot.guestDeposit.newNamePrompt);
    const nameCtx = await conversation.waitFor('message:text');
    const name = nameCtx.message.text.trim();
    if (!name) {
      await ctx.reply(m.bot.guestDeposit.invalidName);
      return;
    }
    const g = await createGuest(ctx.db, { name, createdByUserId: adminId });
    guestId = g.id;
    guestName = g.name;
  } else {
    const g = await getGuest(ctx.db, choice);
    if (!g) {
      await ctx.reply(m.bot.guestDeposit.cancelled);
      return;
    }
    guestId = g.id;
    guestName = g.name;
  }

  // 4. note
  await ctx.reply(m.bot.guestDeposit.notePrompt);
  const noteCtx = await conversation.waitFor('message:text');
  const noteText = noteCtx.message.text.trim();
  const note = noteText === '/skip' ? undefined : noteText;

  // 5. confirm
  const summary = `${formatCents(cents)} · ${method} · ${guestName}${note ? ' · ' + note : ''}`;
  await ctx.reply(m.bot.guestDeposit.confirmPrompt(summary), {
    reply_markup: new InlineKeyboard()
      .text(m.bot.guestDeposit.btnConfirm, 'gd:c:y')
      .text(m.bot.guestDeposit.btnCancel, 'gd:c:n'),
  });
  const confirmCtx = await conversation.waitForCallbackQuery(/^gd:c:(y|n)$/);
  await confirmCtx.answerCallbackQuery();
  if (confirmCtx.match[1] !== 'y') {
    await ctx.reply(m.bot.guestDeposit.cancelled);
    return;
  }

  await recordGuestDeposit(ctx.db, {
    guestId,
    amount: cents,
    method,
    note,
    createdByUserId: adminId,
  });
  await ctx.reply(m.bot.guestDeposit.recorded(method, formatCents(cents), guestName));
}
