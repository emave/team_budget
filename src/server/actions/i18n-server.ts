'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { LOCALES, type Locale } from '@/shared/i18n';
import { updateUserLocale } from '@/server/domain/users';
import { memberAction } from './_wrapper';

const setMyLocaleSchema = z.object({ locale: z.enum(LOCALES as unknown as [Locale, ...Locale[]]) });

export const setMyLocale = memberAction(async ({ user, db }, input: z.infer<typeof setMyLocaleSchema>) => {
  const parsed = setMyLocaleSchema.parse(input);
  await updateUserLocale(db, user.id, parsed.locale);
  cookies().set('tb_locale', parsed.locale, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
});
