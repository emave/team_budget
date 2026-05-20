import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { consumeInvite, findOpenInviteByToken } from '@/server/domain/invites';
import { createUser, getUserByTelegramId, updateUserLocale } from '@/server/domain/users';
import { detectFromTelegram, getMessages, isLocale } from '@/shared/i18n';
import { botMessages } from '../i18n';

export interface StartOptions {
  bootstrapAdminTelegramId: number;
}

export function registerStartHandler(bot: Bot<BotContext>, opts: StartOptions) {
  bot.command('start', async (ctx) => {
    const tgFrom = ctx.from;
    if (!tgFrom) return;

    if (ctx.currentUser) {
      // If the user has no persisted locale yet, capture it from Telegram now.
      if (!isLocale(ctx.currentUser.locale)) {
        const detected = detectFromTelegram(tgFrom.language_code);
        await updateUserLocale(ctx.db, ctx.currentUser.id, detected);
        ctx.currentUser = { ...ctx.currentUser, locale: detected };
      }
      const { m } = botMessages(ctx);
      await ctx.reply(m.bot.start.welcomeBack(ctx.currentUser.displayName));
      return;
    }

    const detectedLocale = detectFromTelegram(tgFrom.language_code);
    const detectedMessages = getMessages(detectedLocale);

    const payload = ctx.match?.trim();
    const inviteToken =
      typeof payload === 'string' && payload.startsWith('invite_')
        ? payload.slice('invite_'.length)
        : undefined;

    if (inviteToken) {
      const invite = await findOpenInviteByToken(ctx.db, inviteToken);
      if (!invite) {
        await ctx.reply(detectedMessages.bot.start.inviteInvalid);
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
        locale: detectedLocale,
      });
      await consumeInvite(ctx.db, inviteToken, newUser.id);
      await ctx.reply(detectedMessages.bot.start.welcomeNew(newUser.displayName));
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
        // Persist locale on the freshly bootstrapped admin
        const u = await getUserByTelegramId(ctx.db, tgFrom.id);
        if (u) await updateUserLocale(ctx.db, u.id, detectedLocale);
        await ctx.reply(detectedMessages.bot.start.welcomeAdmin);
        return;
      }
    }

    await ctx.reply(detectedMessages.bot.start.notMember);
  });
}
