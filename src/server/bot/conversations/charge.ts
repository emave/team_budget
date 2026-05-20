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
import { getNotifier } from '../notifications';

export async function chargeConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;
  const settings = await getOrCreateSettings(ctx.db);

  await ctx.reply('Charge type?', {
    reply_markup: new InlineKeyboard()
      .text('🧾 Single member', 'charge:type:adhoc')
      .row()
      .text('🧮 Split', 'charge:type:split')
      .row()
      .text('💰 Pot borrow', 'charge:type:pot_borrow'),
  });
  const typeCtx = await conversation.waitForCallbackQuery(/^charge:type:(adhoc|split|pot_borrow)$/);
  await typeCtx.answerCallbackQuery();
  const type = typeCtx.match[1];

  const members = await listActiveMembers(ctx.db);
  if (members.length === 0) {
    await ctx.reply('No active members.');
    return;
  }

  if (type === 'adhoc' || type === 'pot_borrow') {
    const kb = new InlineKeyboard();
    members.forEach((m, i) => {
      kb.text(m.displayName, `charge:m:${m.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    await ctx.reply('Member?', { reply_markup: kb });
    const mCtx = await conversation.waitForCallbackQuery(/^charge:m:(.+)$/);
    await mCtx.answerCallbackQuery();
    const userId = mCtx.match[1]!;

    await ctx.reply('Amount?');
    const amountCtx = await conversation.waitFor('message:text');
    let cents: number;
    try { cents = parseDollarsToCents(amountCtx.message.text); }
    catch { await ctx.reply('Invalid amount. Aborted.'); return; }

    let sourcePot: 'cash' | 'card' = 'cash';
    if (type === 'pot_borrow') {
      await ctx.reply('From which pot?', {
        reply_markup: new InlineKeyboard().text('💵 Cash', 'charge:pot:cash').text('💳 Card', 'charge:pot:card'),
      });
      const potCtx = await conversation.waitForCallbackQuery(/^charge:pot:(cash|card)$/);
      await potCtx.answerCallbackQuery();
      sourcePot = potCtx.match[1] as 'cash' | 'card';
    }

    await ctx.reply('Description?');
    const descCtx = await conversation.waitFor('message:text');
    const description = descCtx.message.text;

    if (type === 'adhoc') {
      await createAdhocCharge(ctx.db, { userId, amount: cents, description, createdByUserId: adminId });
    } else {
      await createPotBorrow(ctx.db, { userId, amount: cents, sourcePot, description, createdByUserId: adminId });
    }
    await ctx.reply(`✅ Created ${type} charge of ${formatCents(cents, settings.currency)}.`);
    try {
      await getNotifier().notifyUser(
        userId,
        `🧾 New charge: ${description} ${formatCents(cents, settings.currency)}. Type /balance to see total.`,
      );
    } catch (err) { console.error('[charge] notify failed:', err); }
    return;
  }

  // Split flow
  await ctx.reply('Description?');
  const descCtx = await conversation.waitFor('message:text');
  const description = descCtx.message.text;

  await ctx.reply('Per-member amount (same for everyone)? (e.g., 80.00)');
  const amtCtx = await conversation.waitFor('message:text');
  let perCents: number;
  try { perCents = parseDollarsToCents(amtCtx.message.text); }
  catch { await ctx.reply('Invalid amount. Aborted.'); return; }

  const kb = new InlineKeyboard()
    .text('Everyone', 'charge:split:all')
    .row();
  members.forEach((m, i) => {
    kb.text(m.displayName, `charge:split:${m.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  kb.row().text('✅ Done', 'charge:split:done');

  const picked = new Set<string>();
  await ctx.reply('Pick members (tap names to toggle, then ✅ Done):', { reply_markup: kb });
  while (true) {
    const c = await conversation.waitForCallbackQuery(/^charge:split:(.+)$/);
    await c.answerCallbackQuery();
    const v = c.match[1]!;
    if (v === 'all') { members.forEach((m) => picked.add(m.id)); }
    else if (v === 'done') break;
    else {
      if (picked.has(v)) picked.delete(v);
      else picked.add(v);
    }
    await c.reply(`Selected: ${Array.from(picked).map((id) => members.find((m) => m.id === id)?.displayName ?? id).join(', ') || '(none)'}`);
  }
  if (picked.size === 0) { await ctx.reply('No members selected. Aborted.'); return; }

  const allocations = Array.from(picked).map((id) => ({ userId: id, amount: perCents }));
  await createSplitCharge(ctx.db, { description, allocations, createdByUserId: adminId });
  await ctx.reply(`✅ Created split charge: ${formatCents(perCents, settings.currency)} × ${picked.size} members.`);
  try {
    for (const id of picked) {
      await getNotifier().notifyUser(id, `🧾 New charge: ${description} ${formatCents(perCents, settings.currency)}. Type /balance to see total.`);
    }
  } catch (err) { console.error('[charge] split notify failed:', err); }
}
