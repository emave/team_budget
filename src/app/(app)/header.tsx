'use client';

import type { ComponentType } from 'react';
import { HeaderNavigation, ALIGN, StyledNavigationList, StyledNavigationItem } from 'baseui/header-navigation';
import { StyledLink } from 'baseui/link';
import { useStyletron } from 'baseui';
import Link from 'next/link';
import { useMessages } from '@/app/_i18n-provider';
import { LanguageSwitcher } from '@/app/_language-switcher';
import {
  NavDashboardIcon,
  NavMembersIcon,
  NavDebtsIcon,
  NavPaymentsInIcon,
  NavExpensesIcon,
  NavInfoIcon,
  NavGuestsIcon,
  NavSettingsIcon,
} from '@/ui/icons';

type NavItem = { href: string; label: string; Icon: ComponentType<{ size?: number | string }> };

export function AppHeader({ displayName, role }: { displayName: string; role: 'admin' | 'member' }) {
  const m = useMessages();
  const [css, theme] = useStyletron();

  const labelClass = css({
    display: 'none',
    [theme.mediaQuery.medium]: { display: 'inline' },
  });
  const itemContent = css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  });

  const nav: NavItem[] = [
    { href: '/dashboard', label: m.nav.dashboard, Icon: NavDashboardIcon },
    { href: '/members', label: m.nav.members, Icon: NavMembersIcon },
    { href: '/charges', label: m.nav.charges, Icon: NavDebtsIcon },
    { href: '/payments', label: m.nav.payments, Icon: NavPaymentsInIcon },
    { href: '/spendings', label: m.nav.spendings, Icon: NavExpensesIcon },
    { href: '/info', label: m.nav.info, Icon: NavInfoIcon },
  ];
  const items: NavItem[] =
    role === 'admin'
      ? [
          ...nav,
          { href: '/guests', label: m.nav.guests, Icon: NavGuestsIcon },
          { href: '/settings', label: m.nav.settings, Icon: NavSettingsIcon },
        ]
      : nav;
  return (
    <HeaderNavigation>
      <StyledNavigationList $align={ALIGN.left}>
        <StyledNavigationItem style={{ paddingLeft: 16, fontWeight: 700 }}>🎯 {m.brand}</StyledNavigationItem>
      </StyledNavigationList>
      <StyledNavigationList $align={ALIGN.center}>
        {items.map((i) => (
          <StyledNavigationItem key={i.href}>
            <Link href={i.href} legacyBehavior passHref>
              <StyledLink aria-label={i.label}>
                <span className={itemContent}>
                  <i.Icon size={18} />
                  <span className={labelClass}>{i.label}</span>
                </span>
              </StyledLink>
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
