import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { listOpenChargesForMember, getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';
import { renderTeamOverview } from './team';

export function registerBalanceHandler(bot: Bot<BotContext>) {
  bot.command('balance', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    const settings = await getOrCreateSettings(ctx.db);
    const total = await getMemberOutstandingDebt(ctx.db, ctx.currentUser.id);

    const personalLines: string[] = [];
    personalLines.push(m.bot.team.personalHeading(ctx.currentUser.displayName));
    if (total === 0) {
      personalLines.push(m.bot.settledYes);
    } else {
      const charges = await listOpenChargesForMember(ctx.db, ctx.currentUser.id);
      personalLines.push(m.bot.youOweTotal(formatCents(total, settings.currency)));
      for (const c of charges) {
        personalLines.push(m.bot.chargeBullet(formatCents(c.amount, settings.currency), c.description));
      }
    }

    if (ctx.currentUser.role === 'admin') {
      const team = await renderTeamOverview(ctx);
      await ctx.reply(`${personalLines.join('\n')}\n\n${team}`);
      return;
    }

    await ctx.reply(personalLines.join('\n'));
  });
}
