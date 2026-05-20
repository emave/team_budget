'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { getMessages, type Locale, type Messages } from '@/shared/i18n';

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const messages = getMessages(locale);
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export function useMessages(): Messages {
  return useI18n().messages;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
