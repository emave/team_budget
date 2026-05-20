import type { BotContext } from './context';
import {
  detectFromTelegram,
  getMessages,
  isLocale,
  type Locale,
  type Messages,
} from '@/shared/i18n';

export function resolveBotLocale(ctx: BotContext): Locale {
  if (ctx.currentUser && isLocale(ctx.currentUser.locale)) return ctx.currentUser.locale;
  return detectFromTelegram(ctx.from?.language_code);
}

export function botMessages(ctx: BotContext): { locale: Locale; m: Messages } {
  const locale = resolveBotLocale(ctx);
  return { locale, m: getMessages(locale) };
}
