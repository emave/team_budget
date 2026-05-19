import type { NextFunction } from 'grammy';
import type { BotContext } from './context';
import { getUserByTelegramId } from '@/server/domain/users';

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
    await ctx.reply('This command is for admins only.');
    return;
  }
  await next();
}

export async function requireMember(ctx: BotContext, next: NextFunction) {
  if (!ctx.currentUser) {
    await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
    return;
  }
  await next();
}
