'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/mini', label: 'Home' },
  { href: '/mini/charges', label: 'Charges' },
  { href: '/mini/payments', label: 'Payments' },
  { href: '/mini/info', label: 'Info' },
];

export function MiniTabs() {
  const pathname = usePathname();
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
      background: '#fff', borderTop: '1px solid #e5e7eb', padding: '8px 0',
    }}>
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} style={{
            textAlign: 'center', color: active ? '#16a34a' : '#6b7280',
            fontWeight: active ? 600 : 400, fontSize: 13, textDecoration: 'none',
          }}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
