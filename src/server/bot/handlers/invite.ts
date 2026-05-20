import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { createInvite } from '@/server/domain/invites';
import { env } from '@/server/env';

export function registerInviteHandler(bot: Bot<BotContext>) {
  bot.command('invite', async (ctx) => {
    if (ctx.currentUser?.role !== 'admin') {
      await ctx.reply('This command is for admins only.');
      return;
    }
    const inv = await createInvite(ctx.db, { createdByUserId: ctx.currentUser.id });
    const url = `https://t.me/${env().BOT_USERNAME}?start=invite_${inv.token}`;
    await ctx.reply(`✅ Invite link (single-use):\n${url}`);
  });
}
