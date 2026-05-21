'use client';

import { useEffect } from 'react';

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const THEME_MAP: Record<string, string> = {
  bg_color: '--mini-bg',
  text_color: '--mini-text',
  hint_color: '--mini-hint',
  link_color: '--mini-link',
  button_color: '--mini-button',
  button_text_color: '--mini-button-text',
  secondary_bg_color: '--mini-section-bg',
};

export function MiniInit() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    const root = document.documentElement;
    for (const [k, v] of Object.entries(tg.themeParams)) {
      const cssVar = THEME_MAP[k];
      if (cssVar && typeof v === 'string') root.style.setProperty(cssVar, v);
    }
    document.body.dataset.tgScheme = tg.colorScheme;
  }, []);
  return null;
}
