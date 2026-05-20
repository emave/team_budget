import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { getTeamOverview } from '@/server/domain/team';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';

export async function renderTeamOverview(ctx: BotContext): Promise<string> {
  const { m } = botMessages(ctx);
  const overview = await getTeamOverview(ctx.db);

  if (overview.members.length === 0) {
    return `${m.bot.team.heading}\n${m.bot.team.noMembers}`;
  }

  const lines: string[] = [];
  lines.push(m.bot.team.heading);
  lines.push(m.bot.team.totalOutstanding(formatCents(overview.totalOutstandingCents)));
  lines.push(m.bot.team.potsLine(
    formatCents(overview.cashPotCents),
    formatCents(overview.cardPotCents),
  ));
  lines.push('');
  lines.push(m.bot.team.membersHeading(overview.settledCount, overview.unsettledCount));
  for (const b of overview.members) {
    if (b.outstandingCents > 0) {
      lines.push(m.bot.team.memberLineDebt(b.displayName, formatCents(b.outstandingCents)));
    } else {
      lines.push(m.bot.team.memberLineSettled(b.displayName));
    }
  }
  return lines.join('\n');
}

export function registerTeamHandler(bot: Bot<BotContext>) {
  bot.command('team', async (ctx) => {
    const { m } = botMessages(ctx);
    if (ctx.currentUser?.role !== 'admin') {
      await ctx.reply(m.bot.adminOnly);
      return;
    }
    await ctx.reply(await renderTeamOverview(ctx));
  });
}
