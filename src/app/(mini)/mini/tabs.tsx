'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMessages } from '@/app/_i18n-provider';

interface Tab {
  href: string;
  label: string;
  matchPrefixes?: readonly string[];
}

export function MiniTabs() {
  const m = useMessages();
  const pathname = usePathname();
  const tabs: Tab[] = [
    { href: '/mini', label: m.mini.tabHome },
    { href: '/mini/owed', label: m.mini.tabOwed, matchPrefixes: ['/mini/owed'] },
    { href: '/mini/payments', label: m.mini.tabPayments, matchPrefixes: ['/mini/payments', '/mini/deposits'] },
    { href: '/mini/spent', label: m.mini.tabSpent, matchPrefixes: ['/mini/spent'] },
    {
      href: '/mini/more',
      label: m.mini.tabMore,
      matchPrefixes: [
        '/mini/more',
        '/mini/handbook',
        '/mini/members',
        '/mini/guests',
        '/mini/settings',
        '/mini/history',
      ],
    },
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
        const active =
          pathname === t.href ||
          (t.matchPrefixes ?? []).some((p) => pathname === p || pathname.startsWith(p + '/'));
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
