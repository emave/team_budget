import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import {
  listInfoPages,
  createInfoPage,
  updateInfoPage,
  deleteInfoPage,
} from '@/server/domain/info-pages';

export async function infoEditConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;

  const pages = await listInfoPages(ctx.db);
  const kb = new InlineKeyboard();
  pages.forEach((p, i) => {
    kb.text(p.title.slice(0, 30), `infoed:edit:${p.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  kb.row().text('➕ New entry', 'infoed:new');
  await ctx.reply('Select an entry to edit, or create a new one:', { reply_markup: kb });

  const choice = await conversation.waitForCallbackQuery(/^infoed:(edit|new)(?::(.+))?$/);
  await choice.answerCallbackQuery();
  const mode = choice.match[1];

  if (mode === 'new') {
    await ctx.reply('Title?');
    const tCtx = await conversation.waitFor('message:text');
    await ctx.reply('Body? (Markdown supported)');
    const bCtx = await conversation.waitFor('message:text');
    await createInfoPage(ctx.db, { title: tCtx.message.text, body: bCtx.message.text, updatedByUserId: adminId });
    await ctx.reply('✅ Created.');
    return;
  }

  // edit
  const id = choice.match[2]!;
  await ctx.reply('Action?', {
    reply_markup: new InlineKeyboard()
      .text('✏️ Edit', `infoed:do:edit:${id}`)
      .text('🗑️ Delete', `infoed:do:delete:${id}`),
  });
  const action = await conversation.waitForCallbackQuery(/^infoed:do:(edit|delete):(.+)$/);
  await action.answerCallbackQuery();
  const what = action.match[1];
  if (what === 'delete') {
    await deleteInfoPage(ctx.db, id);
    await ctx.reply('🗑️ Deleted.');
    return;
  }
  await ctx.reply('New title? (or send `.` to keep current)');
  const tCtx = await conversation.waitFor('message:text');
  await ctx.reply('New body? (or send `.` to keep current)');
  const bCtx = await conversation.waitFor('message:text');
  await updateInfoPage(ctx.db, id, {
    title: tCtx.message.text === '.' ? undefined : tCtx.message.text,
    body: bCtx.message.text === '.' ? undefined : bCtx.message.text,
    updatedByUserId: adminId,
  });
  await ctx.reply('✅ Updated.');
}
