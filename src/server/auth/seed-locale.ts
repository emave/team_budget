import 'server-only';
import type { Db } from '@/server/domain/types';
import { updateUserLocale } from '@/server/domain/users';
import { detectFromTelegram, isLocale } from '@/shared/i18n';

type UserRow = { id: string; locale: 'en' | 'ru' | null };

export async function seedLocaleIfMissing<U extends UserRow>(
  db: Db,
  user: U,
  languageCode: string | undefined | null,
): Promise<U> {
  if (user.locale) return user;
  if (!languageCode) return user;
  const prefix = languageCode.toLowerCase().split('-')[0];
  if (prefix !== 'ru' && prefix !== 'en') return user;
  const candidate = detectFromTelegram(languageCode);
  if (!isLocale(candidate)) return user;
  await updateUserLocale(db, user.id, candidate);
  return { ...user, locale: candidate };
}
