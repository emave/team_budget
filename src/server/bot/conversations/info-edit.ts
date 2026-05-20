import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../context';
import {
  listInfoPages,
  createInfoPage,
  updateInfoPage,
  deleteInfoPage,
} from '@/server/domain/info-pages';
import { botMessages } from '../i18n';
import { hydrateConversationCtx } from './hydrate';

export async function infoEditConversation(conversation: BotConversation, ctx: BotContext) {
  await hydrateConversationCtx(ctx);
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;

  const pages = await listInfoPages(ctx.db);
  const kb = new InlineKeyboard();
  pages.forEach((p, i) => {
    kb.text(p.title.slice(0, 30), `infoed:edit:${p.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  kb.row().text(m.bot.infoEdit.newEntryBtn, 'infoed:new');
  await ctx.reply(m.bot.infoEdit.selectPrompt, { reply_markup: kb });

  const choice = await conversation.waitForCallbackQuery(/^infoed:(edit|new)(?::(.+))?$/);
  await choice.answerCallbackQuery();
  const mode = choice.match[1];

  if (mode === 'new') {
    await ctx.reply(m.bot.infoEdit.titlePrompt);
    const tCtx = await conversation.waitFor('message:text');
    await ctx.reply(m.bot.infoEdit.bodyPrompt);
    const bCtx = await conversation.waitFor('message:text');
    await createInfoPage(ctx.db, { title: tCtx.message.text, body: bCtx.message.text, updatedByUserId: adminId });
    await ctx.reply(m.bot.infoEdit.created);
    return;
  }

  // edit
  const id = choice.match[2]!;
  await ctx.reply(m.bot.infoEdit.actionPrompt, {
    reply_markup: new InlineKeyboard()
      .text(m.bot.infoEdit.btnEdit, `infoed:do:edit:${id}`)
      .text(m.bot.infoEdit.btnDelete, `infoed:do:delete:${id}`),
  });
  const action = await conversation.waitForCallbackQuery(/^infoed:do:(edit|delete):(.+)$/);
  await action.answerCallbackQuery();
  const what = action.match[1];
  if (what === 'delete') {
    await deleteInfoPage(ctx.db, id);
    await ctx.reply(m.bot.infoEdit.deleted);
    return;
  }
  await ctx.reply(m.bot.infoEdit.newTitlePrompt);
  const tCtx = await conversation.waitFor('message:text');
  await ctx.reply(m.bot.infoEdit.newBodyPrompt);
  const bCtx = await conversation.waitFor('message:text');
  await updateInfoPage(ctx.db, id, {
    title: tCtx.message.text === '.' ? undefined : tCtx.message.text,
    body: bCtx.message.text === '.' ? undefined : bCtx.message.text,
    updatedByUserId: adminId,
  });
  await ctx.reply(m.bot.infoEdit.updated);
}
