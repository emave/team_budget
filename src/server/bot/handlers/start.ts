import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { consumeInvite, findOpenInviteByToken } from '@/server/domain/invites';
import { createUser, getUserByTelegramId } from '@/server/domain/users';

export interface StartOptions {
  bootstrapAdminTelegramId: number;
}

export function registerStartHandler(bot: Bot<BotContext>, opts: StartOptions) {
  bot.command('start', async (ctx) => {
    const tgFrom = ctx.from;
    if (!tgFrom) return;

    if (ctx.currentUser) {
      await ctx.reply(`Welcome back, ${ctx.currentUser.displayName}. /menu to see options.`);
      return;
    }

    const payload = ctx.match?.trim();
    const inviteToken =
      typeof payload === 'string' && payload.startsWith('invite_')
        ? payload.slice('invite_'.length)
        : undefined;

    if (inviteToken) {
      const invite = await findOpenInviteByToken(ctx.db, inviteToken);
      if (!invite) {
        await ctx.reply('That invite is invalid or has already been used.');
        return;
      }
      const newUser = await createUser(ctx.db, {
        telegramUserId: tgFrom.id,
        telegramUsername: tgFrom.username ?? null,
        displayName:
          invite.displayNameHint ??
          ([tgFrom.first_name, tgFrom.last_name].filter(Boolean).join(' ') ||
            tgFrom.username ||
            `User ${tgFrom.id}`),
        role: 'member',
      });
      await consumeInvite(ctx.db, inviteToken, newUser.id);
      await ctx.reply(`Welcome to the team, ${newUser.displayName}! /menu to see options.`);
      return;
    }

    if (tgFrom.id === opts.bootstrapAdminTelegramId) {
      const result = await bootstrapAdminIfNeeded(ctx.db, {
        telegramUserId: tgFrom.id,
        telegramUsername: tgFrom.username ?? null,
        displayName:
          ([tgFrom.first_name, tgFrom.last_name].filter(Boolean).join(' ') ||
            tgFrom.username ||
            'Admin'),
      });
      if (result.created) {
        await ctx.reply('Welcome, admin. The team budget is yours. /menu to see options.');
        return;
      }
    }

    await ctx.reply(
      'You are not a team member yet. Ask your admin for an invite link.',
    );
  });
}
