'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SIZE } from 'baseui/select';
import { LOCALES, type Locale } from '@/shared/i18n';
import { setMyLocale } from '@/server/actions/i18n-server';
import { useI18n } from './_i18n-provider';

const NAMES: Record<Locale, string> = { en: 'EN', ru: 'RU' };

export function LanguageSwitcher() {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      size={SIZE.mini}
      clearable={false}
      searchable={false}
      disabled={pending}
      options={LOCALES.map((l) => ({ id: l, label: NAMES[l] }))}
      value={[{ id: locale, label: NAMES[locale] }]}
      onChange={({ value }) => {
        const next = value[0]?.id as Locale | undefined;
        if (!next || next === locale) return;
        startTransition(async () => {
          await setMyLocale({ locale: next });
          router.refresh();
        });
      }}
      overrides={{ Root: { style: { width: '80px' } } }}
    />
  );
}
