'use client';

import { useState, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE } from 'baseui/button';
import { Drawer, ANCHOR, SIZE } from 'baseui/drawer';
import { useMessages } from '@/app/_i18n-provider';
import { LanguageSwitcher } from '@/app/_language-switcher';
import { DESKTOP } from '@/ui/breakpoints';
import {
  NavDashboardIcon,
  NavMembersIcon,
  NavDebtsIcon,
  NavPaymentsInIcon,
  NavExpensesIcon,
  NavInfoIcon,
  NavGuestsIcon,
  NavDepositsIcon,
  NavSettingsIcon,
  NavMenuIcon,
  RowCancelIcon,
} from '@/ui/icons';

type NavItem = { href: string; label: string; Icon: ComponentType<{ size?: number | string }> };

const SIDEBAR_WIDTH = 260;

export function AppShell({
  displayName,
  role,
  children,
}: {
  displayName: string;
  role: 'admin' | 'member';
  children: ReactNode;
}) {
  const m = useMessages();
  const [css, theme] = useStyletron();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const baseNav: NavItem[] = [
    { href: '/dashboard', label: m.nav.dashboard, Icon: NavDashboardIcon },
    { href: '/members', label: m.nav.members, Icon: NavMembersIcon },
    { href: '/owed', label: m.nav.owed, Icon: NavDebtsIcon },
    { href: '/payments', label: m.nav.payments, Icon: NavPaymentsInIcon },
    { href: '/spendings', label: m.nav.spendings, Icon: NavExpensesIcon },
    { href: '/handbook', label: m.nav.handbook, Icon: NavInfoIcon },
  ];
  const adminExtras: NavItem[] = [
    { href: '/history', label: m.nav.history, Icon: NavInfoIcon },
    { href: '/guests', label: m.nav.guests, Icon: NavGuestsIcon },
    { href: '/deposits', label: m.nav.deposits, Icon: NavDepositsIcon },
    { href: '/settings', label: m.nav.settings, Icon: NavSettingsIcon },
  ];
  const items: NavItem[] = role === 'admin' ? [...baseNav, ...adminExtras] : baseNav;

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + '/');
  }

  function NavList({ onItemClick }: { onItemClick?: () => void }) {
    return (
      <nav className={css({ flex: 1, overflowY: 'auto', padding: '8px 0' })}>
        {items.map((i) => {
          const active = isActive(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              onClick={onItemClick}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                minHeight: '48px',
                color: theme.colors.contentPrimary,
                background: active ? theme.colors.backgroundSecondary : 'transparent',
                fontWeight: active ? 600 : 400,
                textDecoration: 'none',
              })}
            >
              <i.Icon size={20} />
              <span>{i.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  const shellCss = css({
    [DESKTOP]: {
      display: 'flex',
      minHeight: '100vh',
    },
  });

  const sidebarCss = css({
    display: 'none',
    [DESKTOP]: {
      display: 'flex',
      flexDirection: 'column',
      width: `${SIDEBAR_WIDTH}px`,
      flexShrink: 0,
      borderRight: `1px solid ${theme.colors.borderOpaque}`,
      background: theme.colors.backgroundPrimary,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
    },
  });

  const topbarCss = css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    height: '56px',
    background: theme.colors.backgroundPrimary,
    borderBottom: `1px solid ${theme.colors.borderOpaque}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    [DESKTOP]: { display: 'none' },
  });

  const brandCss = css({
    fontWeight: 700,
    fontSize: '15px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
    '@media (max-width: 359px)': { display: 'none' },
  });

  const userCss = css({
    color: theme.colors.contentSecondary,
    fontSize: '13px',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  const sidebarHeaderCss = css({
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: `1px solid ${theme.colors.borderOpaque}`,
    fontWeight: 700,
    fontSize: '15px',
    minHeight: '56px',
  });

  const sidebarFooterCss = css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderTop: `1px solid ${theme.colors.borderOpaque}`,
    padding: '12px 16px',
    color: theme.colors.contentSecondary,
    fontSize: '13px',
  });

  const sidebarUserCss = css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  const drawerHeaderCss = css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.borderOpaque}`,
    fontWeight: 700,
  });

  const drawerFooterCss = css({
    borderTop: `1px solid ${theme.colors.borderOpaque}`,
    padding: '12px 16px',
    color: theme.colors.contentSecondary,
    fontSize: '13px',
  });

  return (
    <div className={shellCss}>
      <aside className={sidebarCss}>
        <div className={sidebarHeaderCss}>🎯 {m.brand}</div>
        <NavList />
        <div className={sidebarFooterCss}>
          <div className={sidebarUserCss}>
            {displayName}
            {role === 'admin' ? ` ${m.nav.adminBadge}` : ''}
          </div>
          <LanguageSwitcher />
        </div>
      </aside>

      <div className={css({ flex: 1, minWidth: 0 })}>
        <div className={topbarCss}>
          <Button
            kind={KIND.tertiary}
            shape={SHAPE.square}
            onClick={() => setOpen(true)}
            aria-label={m.nav.menu}
          >
            <NavMenuIcon size={22} />
          </Button>
          <div className={brandCss}>🎯 {m.brand}</div>
          <div className={userCss}>
            {displayName}
            {role === 'admin' ? ` ${m.nav.adminBadge}` : ''}
          </div>
          <LanguageSwitcher />
        </div>

        <Drawer
          isOpen={open}
          onClose={() => setOpen(false)}
          anchor={ANCHOR.left}
          size={SIZE.default}
          autoFocus
          overrides={{
            DrawerBody: { style: { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 } },
            DrawerContainer: { style: { width: '280px' } },
          }}
        >
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            })}
          >
            <div className={drawerHeaderCss}>
              <span>🎯 {m.brand}</span>
              <Button
                kind={KIND.tertiary}
                shape={SHAPE.square}
                onClick={() => setOpen(false)}
                aria-label={m.nav.close}
              >
                <RowCancelIcon size={18} />
              </Button>
            </div>
            <NavList onItemClick={() => setOpen(false)} />
            <div className={drawerFooterCss}>
              {displayName}
              {role === 'admin' ? ` ${m.nav.adminBadge}` : ''}
            </div>
          </div>
        </Drawer>

        <main
          className={css({
            maxWidth: '720px',
            margin: '0 auto',
            padding: '16px',
            [DESKTOP]: {
              maxWidth: '960px',
              padding: '24px 32px',
              margin: '0 auto',
            },
          })}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
