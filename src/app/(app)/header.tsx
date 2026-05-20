'use client';

import { HeaderNavigation, ALIGN, StyledNavigationList, StyledNavigationItem } from 'baseui/header-navigation';
import { StyledLink } from 'baseui/link';
import Link from 'next/link';
import { useMessages } from '@/app/_i18n-provider';
import { LanguageSwitcher } from '@/app/_language-switcher';

export function AppHeader({ displayName, role }: { displayName: string; role: 'admin' | 'member' }) {
  const m = useMessages();
  const nav = [
    { href: '/dashboard', label: m.nav.dashboard },
    { href: '/members', label: m.nav.members },
    { href: '/charges', label: m.nav.charges },
    { href: '/payments', label: m.nav.payments },
    { href: '/spendings', label: m.nav.spendings },
    { href: '/info', label: m.nav.info },
  ];
  const items = role === 'admin' ? [...nav, { href: '/settings', label: m.nav.settings }] : nav;
  return (
    <HeaderNavigation>
      <StyledNavigationList $align={ALIGN.left}>
        <StyledNavigationItem style={{ paddingLeft: 16, fontWeight: 700 }}>🎯 {m.brand}</StyledNavigationItem>
      </StyledNavigationList>
      <StyledNavigationList $align={ALIGN.center}>
        {items.map((i) => (
          <StyledNavigationItem key={i.href}>
            <Link href={i.href} legacyBehavior passHref>
              <StyledLink>{i.label}</StyledLink>
            </Link>
          </StyledNavigationItem>
        ))}
      </StyledNavigationList>
      <StyledNavigationList $align={ALIGN.right}>
        <StyledNavigationItem style={{ paddingRight: 8, color: '#666', fontSize: 13 }}>
          {displayName} {role === 'admin' && m.nav.adminBadge}
        </StyledNavigationItem>
        <StyledNavigationItem style={{ paddingRight: 16 }}>
          <LanguageSwitcher />
        </StyledNavigationItem>
      </StyledNavigationList>
    </HeaderNavigation>
  );
}
