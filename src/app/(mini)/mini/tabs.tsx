'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';

export function MiniTabs() {
  const m = useMessages();
  const pathname = usePathname();
  const tabs = [
    { href: '/mini', label: m.mini.tabHome },
    { href: '/mini/charges', label: m.mini.tabCharges },
    { href: '/mini/payments', label: m.mini.tabPayments },
    { href: '/mini/info', label: m.mini.tabInfo },
  ];
  const onTap = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch {
      /* ignore */
    }
  };
  return (
    <nav
      className="mini-tabs"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="mini-tabs__link"
            data-active={active}
            onClick={onTap}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
