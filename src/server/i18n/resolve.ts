import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, detectFromAcceptLanguage, isLocale, type Locale } from '@/shared/i18n';
import { getCurrentUser } from '@/server/auth/server-helpers';

export async function resolveLocaleForRequest(): Promise<Locale> {
  const user = await getCurrentUser();
  if (user && isLocale(user.locale)) return user.locale;

  const cookieValue = (await cookies()).get('tb_locale')?.value;
  if (isLocale(cookieValue)) return cookieValue;

  const acceptLanguage = (await headers()).get('accept-language');
  if (acceptLanguage) return detectFromAcceptLanguage(acceptLanguage);

  return DEFAULT_LOCALE;
}
