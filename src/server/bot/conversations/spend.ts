import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import { recordSpending } from '@/server/domain/spendings';
import { parseDollarsToCents } from '@/shared/format';
import { listCategories } from '@/server/domain/categories';
import { botMessages } from '../i18n';

export async function spendConversation(conversation: BotConversation, ctx: BotContext) {
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;

  // Step 1: pot
  await ctx.reply(m.bot.spend.whichPot, {
    reply_markup: new InlineKeyboard().text(m.bot.spend.btnCash, 'spend:pot:cash').text(m.bot.spend.btnCard, 'spend:pot:card'),
  });
  const potCtx = await conversation.waitForCallbackQuery(/^spend:pot:(cash|card)$/);
  await potCtx.answerCallbackQuery();
  const pot = potCtx.match[1] as 'cash' | 'card';

  // Step 2: amount
  await ctx.reply(m.bot.spend.amountPrompt);
  const amountCtx = await conversation.waitFor('message:text');
  let amountCents: number;
  try {
    amountCents = parseDollarsToCents(amountCtx.message.text);
  } catch {
    await ctx.reply(m.bot.spend.invalidAmount);
    return;
  }

  // Step 3: description
  await ctx.reply(m.bot.spend.descriptionPrompt);
  const descCtx = await conversation.waitFor('message:text');
  const description = descCtx.message.text;

  // Step 4: category (optional)
  const cats = await listCategories(ctx.db);
  let categoryId: string | undefined;
  if (cats.length > 0) {
    const catKb = new InlineKeyboard();
    catKb.text(m.bot.spend.categoryNone, 'spend:cat:none').row();
    cats.forEach((c, i) => {
      catKb.text(c.name, `spend:cat:${c.id}`);
      if ((i + 1) % 2 === 0) catKb.row();
    });
    await ctx.reply(m.bot.spend.categoryPrompt, { reply_markup: catKb });
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
  await ctx.reply(m.bot.spend.recorded(pot, (s.amount / 100).toFixed(2)));
}
