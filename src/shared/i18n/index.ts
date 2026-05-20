import { MESSAGES_EN } from './messages-en';
import { MESSAGES_RU } from './messages-ru';

export type Locale = 'en' | 'ru';
export const LOCALES: readonly Locale[] = ['en', 'ru'] as const;
export const DEFAULT_LOCALE: Locale = 'ru';

export type Messages = typeof MESSAGES_EN;

const catalogs: Record<Locale, Messages> = {
  en: MESSAGES_EN,
  ru: MESSAGES_RU,
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

export function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'ru';
}

export function detectFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tag = header.split(',')[0]?.trim().toLowerCase().split('-')[0];
  if (tag === 'ru') return 'ru';
  if (tag === 'en') return 'en';
  return DEFAULT_LOCALE;
}

export function detectFromTelegram(languageCode: string | undefined | null): Locale {
  if (!languageCode) return DEFAULT_LOCALE;
  const code = languageCode.toLowerCase();
  if (code.startsWith('ru')) return 'ru';
  if (code.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export function formatDateTime(d: string | Date, locale: Locale): string {
  return new Date(d).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
}

export function formatDate(d: string | Date, locale: Locale): string {
  return new Date(d).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US');
}
