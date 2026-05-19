'use client';

import { HeaderNavigation, ALIGN, StyledNavigationList, StyledNavigationItem } from 'baseui/header-navigation';
import { StyledLink } from 'baseui/link';
import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/members', label: 'Members' },
  { href: '/charges', label: 'Charges' },
  { href: '/payments', label: 'Payments' },
  { href: '/spendings', label: 'Spendings' },
  { href: '/info', label: 'Info' },
];

export function AppHeader({ displayName, role }: { displayName: string; role: 'admin' | 'member' }) {
  const items = role === 'admin' ? [...NAV, { href: '/settings', label: 'Settings' }] : NAV;
  return (
    <HeaderNavigation>
      <StyledNavigationList $align={ALIGN.left}>
        <StyledNavigationItem style={{ paddingLeft: 16, fontWeight: 700 }}>🎯 Team Budget</StyledNavigationItem>
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
        <StyledNavigationItem style={{ paddingRight: 16, color: '#666', fontSize: 13 }}>
          {displayName} {role === 'admin' && '(admin)'}
        </StyledNavigationItem>
      </StyledNavigationList>
    </HeaderNavigation>
  );
}
