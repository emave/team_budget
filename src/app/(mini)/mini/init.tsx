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
    if (tg.themeParams.bg_color) {
      document.body.style.background = tg.themeParams.bg_color;
    }
    if (tg.themeParams.text_color) {
      document.body.style.color = tg.themeParams.text_color;
    }
  }, []);
  return null;
}
