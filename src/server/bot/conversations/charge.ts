import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import {
  createAdhocCharge,
  createPotBorrow,
  createSplitCharge,
} from '@/server/domain/charges';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { listActiveMembers } from '@/server/domain/users';
import { getOrCreateSettings } from '@/server/domain/settings';
import { botMessages } from '../i18n';
import { getNotifier } from '../notifications';
import { getMessages, isLocale, detectFromTelegram } from '@/shared/i18n';

export async function chargeConversation(conversation: BotConversation, ctx: BotContext) {
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;
  const settings = await getOrCreateSettings(ctx.db);

  await ctx.reply(m.bot.charge.typePrompt, {
    reply_markup: new InlineKeyboard()
      .text(m.bot.charge.btnSingle, 'charge:type:adhoc')
      .row()
      .text(m.bot.charge.btnSplit, 'charge:type:split')
      .row()
      .text(m.bot.charge.btnPotBorrow, 'charge:type:pot_borrow'),
  });
  const typeCtx = await conversation.waitForCallbackQuery(/^charge:type:(adhoc|split|pot_borrow)$/);
  await typeCtx.answerCallbackQuery();
  const type = typeCtx.match[1];

  const members = await listActiveMembers(ctx.db);
  if (members.length === 0) {
    await ctx.reply(m.bot.charge.noActiveMembers);
    return;
  }

  if (type === 'adhoc' || type === 'pot_borrow') {
    const kb = new InlineKeyboard();
    members.forEach((mm, i) => {
      kb.text(mm.displayName, `charge:m:${mm.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    await ctx.reply(m.bot.charge.memberPrompt, { reply_markup: kb });
    const mCtx = await conversation.waitForCallbackQuery(/^charge:m:(.+)$/);
    await mCtx.answerCallbackQuery();
    const userId = mCtx.match[1]!;

    await ctx.reply(m.bot.charge.amountPrompt);
    const amountCtx = await conversation.waitFor('message:text');
    let cents: number;
    try { cents = parseDollarsToCents(amountCtx.message.text); }
    catch { await ctx.reply(m.bot.charge.invalidAmount); return; }

    let sourcePot: 'cash' | 'card' = 'cash';
    if (type === 'pot_borrow') {
      await ctx.reply(m.bot.charge.fromPotPrompt, {
        reply_markup: new InlineKeyboard().text(m.bot.charge.btnCash, 'charge:pot:cash').text(m.bot.charge.btnCard, 'charge:pot:card'),
      });
      const potCtx = await conversation.waitForCallbackQuery(/^charge:pot:(cash|card)$/);
      await potCtx.answerCallbackQuery();
      sourcePot = potCtx.match[1] as 'cash' | 'card';
    }

    await ctx.reply(m.bot.charge.descriptionPrompt);
    const descCtx = await conversation.waitFor('message:text');
    const description = descCtx.message.text;

    if (type === 'adhoc') {
      await createAdhocCharge(ctx.db, { userId, amount: cents, description, createdByUserId: adminId });
    } else {
      await createPotBorrow(ctx.db, { userId, amount: cents, sourcePot, description, createdByUserId: adminId });
    }
    const formatted = formatCents(cents, settings.currency);
    await ctx.reply(
      type === 'adhoc' ? m.bot.charge.createdAdhoc(formatted) : m.bot.charge.createdPotBorrow(formatted),
    );
    try {
      await getNotifier().notifyUser(
        userId,
        (recipient) => {
          const recipientLocale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
          return getMessages(recipientLocale).bot.charge.notifyCharge(description, formatted);
        },
      );
    } catch (err) { console.error('[charge] notify failed:', err); }
    return;
  }

  // Split flow
  await ctx.reply(m.bot.charge.descriptionPrompt);
  const descCtx = await conversation.waitFor('message:text');
  const description = descCtx.message.text;

  await ctx.reply(m.bot.charge.splitPerMemberPrompt);
  const amtCtx = await conversation.waitFor('message:text');
  let perCents: number;
  try { perCents = parseDollarsToCents(amtCtx.message.text); }
  catch { await ctx.reply(m.bot.charge.invalidAmount); return; }

  const kb = new InlineKeyboard()
    .text(m.bot.charge.splitBtnEveryone, 'charge:split:all')
    .row();
  members.forEach((mm, i) => {
    kb.text(mm.displayName, `charge:split:${mm.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  kb.row().text(m.bot.charge.splitBtnDone, 'charge:split:done');

  const picked = new Set<string>();
  await ctx.reply(m.bot.charge.splitPickPrompt, { reply_markup: kb });
  while (true) {
    const c = await conversation.waitForCallbackQuery(/^charge:split:(.+)$/);
    await c.answerCallbackQuery();
    const v = c.match[1]!;
    if (v === 'all') { members.forEach((mm) => picked.add(mm.id)); }
    else if (v === 'done') break;
    else {
      if (picked.has(v)) picked.delete(v);
      else picked.add(v);
    }
    const names = Array.from(picked).map((id) => members.find((mm) => mm.id === id)?.displayName ?? id).join(', ');
    await c.reply(m.bot.charge.splitSelectedLine(names || m.bot.charge.splitSelectedNone));
  }
  if (picked.size === 0) { await ctx.reply(m.bot.charge.splitNoMembers); return; }

  const allocations = Array.from(picked).map((id) => ({ userId: id, amount: perCents }));
  await createSplitCharge(ctx.db, { description, allocations, createdByUserId: adminId });
  const formattedPer = formatCents(perCents, settings.currency);
  await ctx.reply(m.bot.charge.splitCreated(formattedPer, picked.size));
  try {
    for (const id of picked) {
      await getNotifier().notifyUser(id, (recipient) => {
        const recipientLocale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
        return getMessages(recipientLocale).bot.charge.notifyCharge(description, formattedPer);
      });
    }
  } catch (err) { console.error('[charge] split notify failed:', err); }
}
