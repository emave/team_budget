import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';

const HELP_TEXT = `Commands:
/balance — your outstanding debts
/history — your last 10 charges and payments
/info — team info / FAQ
/menu — main menu

Admin commands (admin only):
/admin — admin menu
/spend — record a spending
/pay — record a payment
/charge — create a charge
/invite — create an invite link
/info_edit — manage FAQ entries`;

export function registerHelpHandler(bot: Bot<BotContext>) {
  bot.command('help', async (ctx) => {
    await ctx.reply(HELP_TEXT);
  });
}
