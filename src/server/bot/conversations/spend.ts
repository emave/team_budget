import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import { recordSpending } from '@/server/domain/spendings';
import { parseDollarsToCents } from '@/shared/format';
import { listCategories } from '@/server/domain/categories';

export async function spendConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;

  // Step 1: pot
  await ctx.reply('Which pot?', {
    reply_markup: new InlineKeyboard().text('💵 Cash', 'spend:pot:cash').text('💳 Card', 'spend:pot:card'),
  });
  const potCtx = await conversation.waitForCallbackQuery(/^spend:pot:(cash|card)$/);
  await potCtx.answerCallbackQuery();
  const pot = potCtx.match[1] as 'cash' | 'card';

  // Step 2: amount
  await ctx.reply('Amount? (e.g., 12.50)');
  const amountCtx = await conversation.waitFor('message:text');
  let amountCents: number;
  try {
    amountCents = parseDollarsToCents(amountCtx.message.text);
  } catch {
    await ctx.reply('Invalid amount. Aborted.');
    return;
  }

  // Step 3: description
  await ctx.reply('Description?');
  const descCtx = await conversation.waitFor('message:text');
  const description = descCtx.message.text;

  // Step 4: category (optional)
  const cats = await listCategories(ctx.db);
  let categoryId: string | undefined;
  if (cats.length > 0) {
    const catKb = new InlineKeyboard();
    catKb.text('— none —', 'spend:cat:none').row();
    cats.forEach((c, i) => {
      catKb.text(c.name, `spend:cat:${c.id}`);
      if ((i + 1) % 2 === 0) catKb.row();
    });
    await ctx.reply('Category?', { reply_markup: catKb });
    const catCtx = await conversation.waitForCallbackQuery(/^spend:cat:(.+)$/);
    await catCtx.answerCallbackQuery();
    const picked = catCtx.match[1];
    categoryId = picked === 'none' ? undefined : picked;
  }

  // Record
  const s = await recordSpending(ctx.db, {
    pot, amount: amountCents, description,
    categoryId: categoryId ?? null,
    createdByUserId: adminId,
  });
  await ctx.reply(`✅ Recorded ${pot} spending of ${(s.amount / 100).toFixed(2)}.`);
}
