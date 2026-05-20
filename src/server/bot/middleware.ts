import type { NextFunction } from 'grammy';
import type { BotContext } from './context';
import { getUserByTelegramId } from '@/server/domain/users';
import { botMessages } from './i18n';

export type { BotContext } from './context';

export async function identifyUser(ctx: BotContext, next: NextFunction) {
  ctx.currentUser = null;
  const tgId = ctx.from?.id;
  if (tgId) {
    const user = await getUserByTelegramId(ctx.db, tgId);
    ctx.currentUser = user ?? null;
  }
  await next();
}

export async function requireAdmin(ctx: BotContext, next: NextFunction) {
  if (ctx.currentUser?.role !== 'admin') {
    const { m } = botMessages(ctx);
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  await next();
}

export async function requireMember(ctx: BotContext, next: NextFunction) {
  if (!ctx.currentUser) {
    const { m } = botMessages(ctx);
    await ctx.reply(m.bot.notMember);
    return;
  }
  await next();
}
