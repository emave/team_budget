'use client';

import { useEffect } from 'react';

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

export function MiniInit() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    Object.entries(tg.themeParams).forEach(([k, v]) => {
      document.body.style.setProperty(`--tg-${k.replace(/_/g, '-')}`, v);
    });
    // UI is light-only; force a readable surface regardless of Telegram dark mode.
    document.body.style.background = '#ffffff';
    document.body.style.color = '#111827';
  }, []);
  return null;
}
