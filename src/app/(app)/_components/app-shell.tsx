'use client';

import { useState, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE } from 'baseui/button';
import { Drawer, ANCHOR, SIZE } from 'baseui/drawer';
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
  NavMenuIcon,
  RowCancelIcon,
} from '@/ui/icons';

type NavItem = { href: string; label: string; Icon: ComponentType<{ size?: number | string }> };

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
    { href: '/charges', label: m.nav.charges, Icon: NavDebtsIcon },
    { href: '/payments', label: m.nav.payments, Icon: NavPaymentsInIcon },
    { href: '/spendings', label: m.nav.spendings, Icon: NavExpensesIcon },
    { href: '/info', label: m.nav.info, Icon: NavInfoIcon },
  ];
  const adminExtras: NavItem[] = [
    { href: '/guests', label: m.nav.guests, Icon: NavGuestsIcon },
    { href: '/settings', label: m.nav.settings, Icon: NavSettingsIcon },
  ];
  const items: NavItem[] = role === 'admin' ? [...baseNav, ...adminExtras] : baseNav;

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + '/');
  }

  const barCss = css({
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

  return (
    <div>
      <div className={barCss}>
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
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: `1px solid ${theme.colors.borderOpaque}`,
              fontWeight: 700,
            })}
          >
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
          <nav className={css({ flex: 1, overflowY: 'auto', padding: '8px 0' })}>
            {items.map((i) => {
              const active = isActive(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setOpen(false)}
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
          <div
            className={css({
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              padding: '12px 16px',
              color: theme.colors.contentSecondary,
              fontSize: '13px',
            })}
          >
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
        })}
      >
        {children}
      </main>
    </div>
  );
}
