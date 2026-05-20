import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { createInvite } from '@/server/domain/invites';
import { env } from '@/server/env';
import { botMessages } from '../i18n';

export function registerInviteHandler(bot: Bot<BotContext>) {
  bot.command('invite', async (ctx) => {
    const { m } = botMessages(ctx);
    if (ctx.currentUser?.role !== 'admin') {
      await ctx.reply(m.bot.inviteOnlyAdmin);
      return;
    }
    const inv = await createInvite(ctx.db, { createdByUserId: ctx.currentUser.id });
    const url = `https://t.me/${env().BOT_USERNAME}?start=invite_${inv.token}`;
    await ctx.reply(m.bot.inviteLine(url));
  });
}
