'use client';

import { useTransition } from 'react';
import { useLocale } from '@/app/_i18n-provider';
import type { Locale } from '@/shared/i18n';
import { setMyLocale } from '@/server/actions/i18n-server';

export function LocaleChip() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const flip = (next: Locale) => () => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setMyLocale({ locale: next });
      window.location.reload();
    });
  };

  return (
    <div className="mini-locale-chip" aria-label="Language">
      <button type="button" onClick={flip('ru')} data-active={locale === 'ru'} disabled={pending}>
        RU
      </button>
      <button type="button" onClick={flip('en')} data-active={locale === 'en'} disabled={pending}>
        EN
      </button>
    </div>
  );
}
