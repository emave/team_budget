# Mobile-friendly UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `(app)` admin/desktop UI as one mobile-first layout — hamburger drawer instead of an 8-icon header row; vertical cards instead of `TableBuilder`; wrapping `PageHeader`; stacked forms; `MoneyHistory` relocated to its own page. Polish `/mini` and `/login` for tap targets.

**Architecture:** Replace the shell + table abstractions in two new shared primitives (`AppShell`, `DataCard`/`DataList`). All page-level components keep their data-shaping logic; only the presentational layer changes. The `<main>` column is capped at 720px so a single layout works phone → desktop.

**Tech Stack:** Next.js 14 (App Router, server components for pages + `'use client'` for shells), Base Web (`baseui`) + Styletron, `react-query`, `react-hook-form`, Vitest (node-environment only — no React unit tests).

**Spec:** [docs/superpowers/specs/2026-05-22-mobile-friendly-ui-design.md](../specs/2026-05-22-mobile-friendly-ui-design.md)

---

## File map

**New:**
- `src/ui/breakpoints.ts` — one breakpoint constant (SMALL_MAX_PX = 599; SMALL = '@media (max-width: 599px)').
- `src/ui/data-card.tsx` — `DataCard` component (title, titleRight, subtitle, badges, actions, optional href).
- `src/ui/data-list.tsx` — `DataList` component (renders children OR empty message).
- `src/ui/submit-button.tsx` — `SubmitButton` wrapping `baseui/button` with `width:100%` style override (used by all forms).
- `src/app/(app)/_components/app-shell.tsx` — sticky top bar + drawer + content wrapper.
- `src/app/(app)/dashboard/history/page.tsx` — dedicated history page.

**Modified:**
- `src/app/(app)/layout.tsx` — render `<AppShell>` instead of inline `<AppHeader/> + <main/>`.
- `src/app/(app)/header.tsx` — deleted; AppShell replaces it.
- `src/ui/page-header.tsx` — wrap actions when crowded.
- `src/ui/icons.tsx` — add `ListIcon` (hamburger), `XIcon` reused as drawer-close.
- `src/app/(app)/members/members-table.tsx` — convert TableBuilder → DataList/DataCard.
- `src/app/(app)/members/pending-invites-table.tsx` — convert.
- `src/app/(app)/members/[id]/detail-tables.tsx` — convert both tables.
- `src/app/(app)/members/[id]/admin-controls.tsx` — full-width buttons under SMALL.
- `src/app/(app)/charges/charges-table.tsx` — convert.
- `src/app/(app)/payments/payments-table.tsx` — convert.
- `src/app/(app)/spendings/spendings-table.tsx` — convert.
- `src/app/(app)/guests/guests-table.tsx` — convert.
- `src/app/(app)/guests/deposits/matrix.tsx` — wrap in overflow-x scroll container; remove inline widths if any.
- `src/app/(app)/dashboard/page.tsx` — pots stack; remove inline `<MoneyHistory>`; add "View history" link.
- `src/app/(app)/dashboard/pot-card.tsx` — ensure margin-bottom for vertical stack.
- `src/app/(app)/dashboard/money-history.tsx` — header flex-wrap; drop DatePicker minWidth.
- `src/app/(app)/charges/new/adhoc-form.tsx`, `pot-borrow-form.tsx`, `split-form.tsx`, `new-charge-tabs.tsx` — remove `maxWidth: 480/640`; use SubmitButton; SplitForm row stacks on narrow.
- `src/app/(app)/payments/new/record-form.tsx`, `src/app/(app)/spendings/new/record-form.tsx` — remove `maxWidth`; use SubmitButton; allocations table wrap in overflow-x.
- `src/app/(app)/settings/dues-form.tsx`, `pot-openings-form.tsx` — remove `maxWidth: 360`; SubmitButton; buttons stack on narrow.
- `src/app/(app)/members/[id]/charge-dues-form.tsx` — SubmitButton; field+button stack on narrow.
- `src/app/login/page.tsx` — center via flex; position LanguageSwitcher; gap 24.
- `src/app/(mini)/_components/mini-row.tsx` — `min-height: 48px` when interactive.
- `src/app/(mini)/_components/locale-chip.tsx` — `min-height: 40px`.
- `src/app/(mini)/mini/tabs.tsx` — `min-height: 44px` per tab; horizontal scroll wrapper.
- `src/app/(mini)/mini/charges/page.tsx` — filter chip `min-height: 40px`.
- `src/shared/i18n/messages-en.ts`, `src/shared/i18n/messages-ru.ts` — add `nav.menu`, `nav.close`, `dashboard.viewHistory`.

**Verified unchanged:** every `src/server/**` file, all bot code, schema, migrations, all `tests/**`.

---

## Phase 1 — Foundations

### Task 1.1: Add breakpoint module

**Files:**
- Create: `src/ui/breakpoints.ts`

- [ ] **Step 1: Write the file**

```ts
// src/ui/breakpoints.ts
export const SMALL_MAX_PX = 599;
export const SMALL = `@media (max-width: ${SMALL_MAX_PX}px)`;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/breakpoints.ts
git commit -m "feat(ui): SMALL breakpoint token"
```

### Task 1.2: Add SubmitButton helper

**Files:**
- Create: `src/ui/submit-button.tsx`

- [ ] **Step 1: Write the file**

```tsx
// src/ui/submit-button.tsx
'use client';

import type { ReactNode } from 'react';
import { Button, type ButtonProps } from 'baseui/button';

// Full-width on all viewports — fits the mobile-first single-layout shell.
export function SubmitButton({
  children,
  ...rest
}: ButtonProps & { children: ReactNode }) {
  return (
    <Button
      {...rest}
      overrides={{
        ...rest.overrides,
        BaseButton: {
          ...rest.overrides?.BaseButton,
          style: ({ $theme }) => ({
            width: '100%',
            ...(typeof rest.overrides?.BaseButton === 'object' &&
            rest.overrides.BaseButton !== null &&
            'style' in rest.overrides.BaseButton &&
            typeof rest.overrides.BaseButton.style === 'function'
              ? (rest.overrides.BaseButton.style as (a: { $theme: typeof $theme }) => Record<string, unknown>)({ $theme })
              : {}),
          }),
        },
      }}
    >
      {children}
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/submit-button.tsx
git commit -m "feat(ui): SubmitButton helper (full-width)"
```

### Task 1.3: Add DataCard + DataList primitives

**Files:**
- Create: `src/ui/data-card.tsx`
- Create: `src/ui/data-list.tsx`

- [ ] **Step 1: Write `data-card.tsx`**

```tsx
// src/ui/data-card.tsx
'use client';

import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useStyletron } from 'baseui';

interface DataCardProps {
  title: ReactNode;
  titleRight?: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  href?: string;
}

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"]';

export function DataCard({ title, titleRight, subtitle, badges, actions, href }: DataCardProps) {
  const [css, theme] = useStyletron();

  const cardCss = css({
    display: 'block',
    color: 'inherit',
    textDecoration: 'none',
    background: theme.colors.backgroundPrimary,
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    padding: '12px 14px',
    marginBottom: '8px',
    ':hover': href ? { background: theme.colors.backgroundSecondary } : {},
    ':focus-visible': { outline: `2px solid ${theme.colors.borderAccent}`, outlineOffset: '2px' },
  });

  const titleRowCss = css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '12px',
    minWidth: 0,
  });

  const titleCss = css({
    fontSize: '15px',
    fontWeight: 500,
    color: theme.colors.contentPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  });

  const titleRightCss = css({
    fontSize: '17px',
    fontWeight: 600,
    color: theme.colors.contentPrimary,
    whiteSpace: 'nowrap',
  });

  const subtitleCss = css({
    fontSize: '13px',
    color: theme.colors.contentSecondary,
    marginTop: '2px',
  });

  const badgesCss = css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  });

  const actionsCss = css({
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: `1px solid ${theme.colors.borderOpaque}`,
    '> *': { flex: 1 },
  });

  const inner = (
    <>
      <div className={titleRowCss}>
        <div className={titleCss}>{title}</div>
        {titleRight ? <div className={titleRightCss}>{titleRight}</div> : null}
      </div>
      {subtitle ? <div className={subtitleCss}>{subtitle}</div> : null}
      {badges ? <div className={badgesCss}>{badges}</div> : null}
      {actions ? (
        <div className={actionsCss} onClick={(e: MouseEvent) => e.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardCss}>
        {inner}
      </Link>
    );
  }
  return <div className={cardCss}>{inner}</div>;
}
```

- [ ] **Step 2: Write `data-list.tsx`**

```tsx
// src/ui/data-list.tsx
'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';

interface DataListProps {
  children: ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
}

export function DataList({ children, emptyMessage, isEmpty }: DataListProps) {
  const [css, theme] = useStyletron();
  if (isEmpty) {
    return (
      <div
        className={css({
          padding: '24px',
          textAlign: 'center',
          color: theme.colors.contentSecondary,
        })}
      >
        {emptyMessage}
      </div>
    );
  }
  return <div>{children}</div>;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/data-card.tsx src/ui/data-list.tsx
git commit -m "feat(ui): DataCard and DataList primitives"
```

### Task 1.4: Wrap PageHeader to wrap actions

**Files:**
- Modify: `src/ui/page-header.tsx`

- [ ] **Step 1: Replace component body**

Replace the entire file with:

```tsx
'use client';

import type { ReactNode } from 'react';
import { useStyletron } from 'baseui';
import { HeadingMedium, LabelSmall } from 'baseui/typography';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        display: 'flex',
        flexWrap: 'wrap',
        rowGap: theme.sizing.scale400,
        columnGap: theme.sizing.scale600,
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.sizing.scale600,
      })}
    >
      <div className={css({ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 })}>
        <HeadingMedium marginTop="0" marginBottom="0">{title}</HeadingMedium>
        {subtitle ? (
          <LabelSmall color={theme.colors.contentSecondary}>{subtitle}</LabelSmall>
        ) : null}
      </div>
      {actions ? (
        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 })}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/page-header.tsx
git commit -m "feat(ui): PageHeader wraps actions when crowded"
```

### Task 1.5: Add new i18n keys

**Files:**
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`

- [ ] **Step 1: Locate the existing `nav: { ... }` and `dashboard: { ... }` blocks in each file**

Run: `grep -n "  nav: {" src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts`

- [ ] **Step 2: Edit `messages-en.ts`**

Inside the `nav` block, add:

```ts
    menu: 'Menu',
    close: 'Close',
```

Inside the `dashboard` block, add:

```ts
    viewHistory: 'View money history',
```

- [ ] **Step 3: Edit `messages-ru.ts`**

Inside the `nav` block, add:

```ts
    menu: 'Меню',
    close: 'Закрыть',
```

Inside the `dashboard` block, add:

```ts
    viewHistory: 'Открыть историю движений',
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (TS will fail if the EN and RU shapes diverge, so this verifies both are updated consistently).

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts
git commit -m "feat(i18n): nav.menu/close + dashboard.viewHistory"
```

---

## Phase 2 — App shell

### Task 2.1: Add hamburger icon to icons module

**Files:**
- Modify: `src/ui/icons.tsx`

- [ ] **Step 1: Edit**

Add to the export list (alongside existing icons):

```ts
  ListIcon as NavMenuIcon,
```

Full updated file body — just add the `ListIcon` line; keep the rest.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/icons.tsx
git commit -m "feat(ui): NavMenuIcon (hamburger) re-export"
```

### Task 2.2: Build AppShell component

**Files:**
- Create: `src/app/(app)/_components/app-shell.tsx`

- [ ] **Step 1: Write the file**

```tsx
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

  const bar = css({
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

  return (
    <div>
      <div className={bar}>
        <Button
          kind={KIND.tertiary}
          shape={SHAPE.square}
          onClick={() => setOpen(true)}
          aria-label={m.nav.menu}
        >
          <NavMenuIcon size={22} />
        </Button>
        <div
          className={css({
            fontWeight: 700,
            fontSize: '15px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
            '@media (max-width: 359px)': { display: 'none' },
          })}
        >
          🎯 {m.brand}
        </div>
        <div
          className={css({
            color: theme.colors.contentSecondary,
            fontSize: '13px',
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          })}
        >
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/_components/app-shell.tsx
git commit -m "feat(ui): AppShell with sticky top bar + drawer nav"
```

### Task 2.3: Switch layout to AppShell; delete old header

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Delete: `src/app/(app)/header.tsx`

- [ ] **Step 1: Replace `layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { requireUser } from '@/server/auth/server-helpers';
import { bootOnce } from '@/server/boot';
import { env } from '@/server/env';
import { AppShell } from './_components/app-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await bootOnce();
  const user = await requireUser();
  const e = env();
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: `window.__BOT_USERNAME__=${JSON.stringify(e.BOT_USERNAME)};` }}
      />
      <AppShell displayName={user.displayName} role={user.role}>
        {children}
      </AppShell>
    </>
  );
}
```

- [ ] **Step 2: Delete `header.tsx`**

```bash
git rm src/app/\(app\)/header.tsx
```

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS for both.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "feat(ui): use AppShell in (app) layout; remove old AppHeader"
```

---

## Phase 3 — Convert listing tables to DataCard

### Task 3.1: Convert `/members` listing

**Files:**
- Modify: `src/app/(app)/members/members-table.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { Muted, StatusBadge } from '@/ui/text';

export interface MemberRow {
  id: string;
  displayName: string;
  role: 'admin' | 'member';
  isActive: boolean;
  debtFormatted: string | null;
  creditFormatted?: string | null;
}

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.common.none} isEmpty={rows.length === 0}>
      {rows.map((r) => {
        const badges = (
          <>
            {r.creditFormatted ? (
              <StatusBadge tone="positive">{r.creditFormatted}</StatusBadge>
            ) : null}
            {r.debtFormatted ? (
              <StatusBadge tone="negative">{m.common.owesAmount(r.debtFormatted)}</StatusBadge>
            ) : (
              !r.creditFormatted && <StatusBadge tone="positive">{m.common.settled}</StatusBadge>
            )}
          </>
        );
        return (
          <DataCard
            key={r.id}
            href={`/members/${r.id}`}
            title={
              <>
                {r.displayName}
                {!r.isActive && <Muted>{` ${m.common.inactive}`}</Muted>}
              </>
            }
            subtitle={r.role}
            badges={badges}
          />
        );
      })}
    </DataList>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/members/members-table.tsx
git commit -m "feat(ui): /members listing uses DataCard"
```

### Task 3.2: Convert `/charges` listing

**Files:**
- Modify: `src/app/(app)/charges/charges-table.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { StatusBadge } from '@/ui/text';
import { StatusOpenIcon, StatusPaidIcon, StatusCancelledIcon } from '@/ui/icons';
import { CancelChargeButton } from './cancel-button';
import { PayFromCreditButton } from './pay-from-credit-button';
import type { Messages } from '@/shared/i18n';

export interface ChargeRow {
  id: string;
  type: string;
  description: string;
  userDisplayName: string;
  amountFormatted: string;
  status: 'open' | 'paid' | 'cancelled' | string;
  whenFormatted: string;
  showCancel: boolean;
  creditAvailableCents?: number;
  remainingCents?: number;
}

const TYPE_KEYS: Record<string, keyof Messages['charges']> = {
  adhoc: 'typeAdhoc',
  split: 'typeSplit',
  pot_borrow: 'typePotBorrow',
  monthly_dues: 'typeMonthlyDues',
  out_of_bounds: 'typeOutOfBounds',
};

const STATUS_KEYS: Record<string, keyof Messages['charges']> = {
  open: 'statusOpen',
  paid: 'statusPaid',
  cancelled: 'statusCancelled',
};

export function ChargesTable({ rows }: { rows: ChargeRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.charges.none} isEmpty={rows.length === 0}>
      {rows.map((r) => {
        const typeLabel = TYPE_KEYS[r.type]
          ? (m.charges[TYPE_KEYS[r.type]!] as string)
          : r.type;
        const statusLabel = STATUS_KEYS[r.status]
          ? (m.charges[STATUS_KEYS[r.status]!] as string)
          : r.status;
        const tone = r.status === 'paid' ? 'positive' : r.status === 'open' ? 'negative' : 'neutral';
        const Icon =
          r.status === 'paid' ? StatusPaidIcon : r.status === 'open' ? StatusOpenIcon : StatusCancelledIcon;
        const actions =
          r.status === 'open' &&
          ((r.showCancel) ||
            (r.type !== 'monthly_dues' &&
              (r.creditAvailableCents ?? 0) > 0 &&
              (r.remainingCents ?? 0) > 0)) ? (
            <>
              {r.type !== 'monthly_dues' &&
                (r.creditAvailableCents ?? 0) > 0 &&
                (r.remainingCents ?? 0) > 0 && (
                  <PayFromCreditButton
                    chargeId={r.id}
                    remainingCents={r.remainingCents ?? 0}
                    creditAvailableCents={r.creditAvailableCents ?? 0}
                  />
                )}
              {r.showCancel ? <CancelChargeButton id={r.id} /> : null}
            </>
          ) : null;
        return (
          <DataCard
            key={r.id}
            title={`${r.description} — ${r.userDisplayName}`}
            titleRight={r.amountFormatted}
            subtitle={`${typeLabel} · ${r.whenFormatted}`}
            badges={
              <StatusBadge tone={tone} icon={<Icon size={14} />}>
                {statusLabel}
              </StatusBadge>
            }
            actions={actions}
          />
        );
      })}
    </DataList>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/charges/charges-table.tsx
git commit -m "feat(ui): /charges listing uses DataCard"
```

### Task 3.3: Convert `/payments` listing

**Files:**
- Modify: `src/app/(app)/payments/payments-table.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { StatusBadge } from '@/ui/text';
import { StatusCancelledIcon } from '@/ui/icons';
import { CancelPaymentButton } from './cancel-button';

export interface PaymentRow {
  id: string;
  payerDisplayName: string;
  method: string;
  amountFormatted: string;
  whenFormatted: string;
  cancelled: boolean;
  showCancel: boolean;
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.payments.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={r.payerDisplayName}
          titleRight={r.amountFormatted}
          subtitle={`${r.method} · ${r.whenFormatted}`}
          badges={
            r.cancelled ? (
              <StatusBadge tone="neutral" icon={<StatusCancelledIcon size={14} />}>
                {m.common.cancelled}
              </StatusBadge>
            ) : null
          }
          actions={r.showCancel ? <CancelPaymentButton id={r.id} /> : null}
        />
      ))}
    </DataList>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/payments/payments-table.tsx
git commit -m "feat(ui): /payments listing uses DataCard"
```

### Task 3.4: Convert `/spendings` listing

**Files:**
- Modify: `src/app/(app)/spendings/spendings-table.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { StatusBadge } from '@/ui/text';
import { StatusCancelledIcon } from '@/ui/icons';
import { CancelSpendingButton } from './cancel-button';

export interface SpendingRow {
  id: string;
  pot: string;
  description: string;
  category: string;
  amountFormatted: string;
  whenFormatted: string;
  cancelled: boolean;
  showCancel: boolean;
}

export function SpendingsTable({ rows }: { rows: SpendingRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.spendings.none} isEmpty={rows.length === 0}>
      {rows.map((r) => {
        const subtitleParts = [r.pot, r.category, r.whenFormatted].filter(Boolean);
        return (
          <DataCard
            key={r.id}
            title={r.description}
            titleRight={r.amountFormatted}
            subtitle={subtitleParts.join(' · ')}
            badges={
              r.cancelled ? (
                <StatusBadge tone="neutral" icon={<StatusCancelledIcon size={14} />}>
                  {m.common.cancelled}
                </StatusBadge>
              ) : null
            }
            actions={r.showCancel ? <CancelSpendingButton id={r.id} /> : null}
          />
        );
      })}
    </DataList>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/spendings/spendings-table.tsx
git commit -m "feat(ui): /spendings listing uses DataCard"
```

### Task 3.5: Convert `/guests` listing

**Files:**
- Modify: `src/app/(app)/guests/guests-table.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { Muted } from '@/ui/text';
import { RenameButton } from './rename-button';
import { ArchiveButton } from './archive-button';

export interface GuestRow {
  id: string;
  name: string;
  archived: boolean;
  totalFormatted: string;
  count: number;
  lastFormatted: string;
}

export function GuestsTable({ rows }: { rows: GuestRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.guests.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={
            <>
              {r.name}
              {r.archived && <Muted>{m.guests.archivedSuffix}</Muted>}
            </>
          }
          titleRight={r.totalFormatted}
          subtitle={`${r.count} · ${r.lastFormatted}`}
          actions={
            <>
              <RenameButton id={r.id} name={r.name} />
              <ArchiveButton id={r.id} archived={r.archived} />
            </>
          }
        />
      ))}
    </DataList>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/guests/guests-table.tsx
git commit -m "feat(ui): /guests listing uses DataCard"
```

### Task 3.6: Convert pending invites table

**Files:**
- Modify: `src/app/(app)/members/pending-invites-table.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button, KIND, SIZE } from 'baseui/button';
import { revokeInvite } from '@/server/actions/members-server';
import { useLocale, useMessages } from '@/app/_i18n-provider';
import { formatDate } from '@/shared/i18n';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';
import { Muted } from '@/ui/text';

export interface PendingInviteRow {
  id: string;
  token: string;
  displayNameHint: string | null;
  createdAt: string;
}

function buildInviteLink(token: string): string {
  const botUsername = (window as { __BOT_USERNAME__?: string }).__BOT_USERNAME__ ?? '';
  return botUsername ? `https://t.me/${botUsername}?start=invite_${token}` : `invite_${token}`;
}

export function PendingInvitesTable({ rows }: { rows: PendingInviteRow[] }) {
  const m = useMessages();
  const locale = useLocale();
  return (
    <DataList emptyMessage={m.members.noPendingInvites} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={r.displayNameHint ? r.displayNameHint : <Muted>{m.members.hintEmpty}</Muted>}
          subtitle={formatDate(r.createdAt, locale)}
          actions={<RowActions row={r} />}
        />
      ))}
    </DataList>
  );
}

function RowActions({ row }: { row: PendingInviteRow }) {
  const m = useMessages();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const revoke = useMutation({
    mutationFn: () => revokeInvite({ id: row.id }),
    onSuccess: () => router.refresh(),
  });

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(buildInviteLink(row.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked; ignore
    }
  }

  function onRevoke() {
    if (!window.confirm(m.members.confirmRevoke)) return;
    revoke.mutate();
  }

  return (
    <>
      <Button kind={KIND.secondary} size={SIZE.compact} onClick={onCopy}>
        {copied ? m.members.copied : m.members.copyLink}
      </Button>
      <Button
        kind={KIND.secondary}
        size={SIZE.compact}
        onClick={onRevoke}
        isLoading={revoke.isPending}
      >
        {m.members.revoke}
      </Button>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/members/pending-invites-table.tsx
git commit -m "feat(ui): pending-invites uses DataCard"
```

### Task 3.7: Convert member-detail tables

**Files:**
- Modify: `src/app/(app)/members/[id]/detail-tables.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useMessages } from '@/app/_i18n-provider';
import { DataList } from '@/ui/data-list';
import { DataCard } from '@/ui/data-card';

export interface OpenChargeRow {
  id: string;
  description: string;
  amountFormatted: string;
}

export interface PaymentHistoryRow {
  id: string;
  whenFormatted: string;
  method: string;
  amountFormatted: string;
}

export function OpenChargesTable({ rows }: { rows: OpenChargeRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.common.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={r.description}
          titleRight={r.amountFormatted}
        />
      ))}
    </DataList>
  );
}

export function PaymentHistoryTable({ rows }: { rows: PaymentHistoryRow[] }) {
  const m = useMessages();
  return (
    <DataList emptyMessage={m.common.none} isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <DataCard
          key={r.id}
          title={r.method}
          titleRight={r.amountFormatted}
          subtitle={r.whenFormatted}
        />
      ))}
    </DataList>
  );
}
```

- [ ] **Step 2: Typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/members/\[id\]/detail-tables.tsx
git commit -m "feat(ui): member-detail tables use DataCard"
```

---

## Phase 4 — Dashboard

### Task 4.1: Move MoneyHistory to its own page

**Files:**
- Create: `src/app/(app)/dashboard/history/page.tsx`

- [ ] **Step 1: Write the new page**

```tsx
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listMoneyMovements } from '@/server/domain/movements';
import { resolveDashboardRange } from '@/shared/date-range';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { MoneyHistory } from '../money-history';

export default async function DashboardHistory({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/dashboard');
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const range = resolveDashboardRange({ from: searchParams.from, to: searchParams.to });
  const movements = await listMoneyMovements(db, { from: range.from, to: range.to });
  return (
    <div>
      <PageHeader title={m.dashboard.movementsHeading} />
      <MoneyHistory
        movements={movements}
        range={{ from: range.from, to: range.to }}
        clamped={range.clamped}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/history/page.tsx
git commit -m "feat(ui): dedicated /dashboard/history page"
```

### Task 4.2: Update MoneyHistory header to wrap

**Files:**
- Modify: `src/app/(app)/dashboard/money-history.tsx`

- [ ] **Step 1: Find the header row**

It's at line ~107 — the `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12 }}>` block.

- [ ] **Step 2: Replace that div opening tag and the DatePicker wrapper**

Replace:

```tsx
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <HeadingSmall marginTop="0" marginBottom="0">{m.dashboard.movementsHeading}</HeadingSmall>
          <div style={{ minWidth: 280 }}>
            <DatePicker
              value={pickerValue}
              onChange={({ date }) => applyRange(Array.isArray(date) ? date : [date])}
              range
              quickSelect
              formatString="yyyy-MM-dd"
            />
          </div>
        </div>
```

With:

```tsx
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap', rowGap: 8 }}>
          <HeadingSmall marginTop="0" marginBottom="0">{m.dashboard.movementsHeading}</HeadingSmall>
          <div style={{ flex: '1 1 240px' }}>
            <DatePicker
              value={pickerValue}
              onChange={({ date }) => applyRange(Array.isArray(date) ? date : [date])}
              range
              quickSelect
              formatString="yyyy-MM-dd"
            />
          </div>
        </div>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/money-history.tsx
git commit -m "feat(ui): MoneyHistory header wraps on narrow"
```

### Task 4.3: Restructure dashboard (admin) — pots stack, history link

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/dashboard/pot-card.tsx`

- [ ] **Step 1: Update `pot-card.tsx`**

Replace the `Card` overrides to add bottom-margin:

```tsx
'use client';

import { Card, StyledBody } from 'baseui/card';
import { formatCents } from '@/shared/format';

export function PotCard({ label, cents }: { label: string; cents: number }) {
  return (
    <Card overrides={{ Root: { style: { width: '100%', marginBottom: '12px' } } }}>
      <StyledBody>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{formatCents(cents)}</div>
      </StyledBody>
    </Card>
  );
}
```

- [ ] **Step 2: Edit `dashboard/page.tsx`**

Replace the admin-branch return block. Find:

```tsx
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <PotCard label={m.dashboard.cashPot} cents={pots.cash} />
          <PotCard label={m.dashboard.cardPot} cents={pots.card} />
        </div>
```

Replace with:

```tsx
    return (
      <div>
        <PotCard label={m.dashboard.cashPot} cents={pots.cash} />
        <PotCard label={m.dashboard.cardPot} cents={pots.card} />
```

Then find:

```tsx
        <MoneyHistory
          movements={movements}
          range={{ from: range.from, to: range.to }}
          clamped={range.clamped}
        />
      </div>
    );
```

Replace with:

```tsx
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href="/dashboard/history">{m.dashboard.viewHistory}</Link>
        </div>
      </div>
    );
```

Add import at top:

```tsx
import Link from 'next/link';
```

Remove now-unused imports: `MoneyHistory`, `listMoneyMovements`, `resolveDashboardRange`. Also remove `movements` and `range` from the `Promise.all` and any related variables — they're no longer used on this page.

After editing, the admin branch's data fetch becomes:

```tsx
  if (user.role === 'admin') {
    const [pots, members, totalCreditLiability, memberCredits] = await Promise.all([
      getPotBalances(db),
      listActiveMembers(db),
      getTotalCreditLiability(db),
      listMemberCreditBalances(db),
    ]);
    const debts = await Promise.all(members.map((mm) => getMemberOutstandingDebt(db, mm.id)));
    const creditByUser = new Map(memberCredits.map((c) => [c.userId, c.balance]));
    // ... memberRows mapping unchanged ...
```

And the `searchParams` param can be dropped from the signature since the dashboard no longer reads `from`/`to`:

```tsx
export default async function DashboardPage() {
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx src/app/\(app\)/dashboard/pot-card.tsx
git commit -m "feat(ui): dashboard stacks pots; MoneyHistory moved to /dashboard/history"
```

---

## Phase 5 — Forms

### Task 5.1: AdhocForm

**Files:**
- Modify: `src/app/(app)/charges/new/adhoc-form.tsx`

- [ ] **Step 1: Replace `maxWidth: 480` and the submit Button**

Find:

```tsx
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
```

Replace with:

```tsx
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} style={{ display: 'grid', gap: 12 }}>
```

Find:

```tsx
      <Button type="submit" isLoading={mut.isPending} disabled={!userId}>{m.charges.submitAdhoc}</Button>
```

Replace with:

```tsx
      <SubmitButton type="submit" isLoading={mut.isPending} disabled={!userId}>{m.charges.submitAdhoc}</SubmitButton>
```

Update imports: remove `Button` from `baseui/button` import, add:

```tsx
import { SubmitButton } from '@/ui/submit-button';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/charges/new/adhoc-form.tsx
git commit -m "feat(ui): AdhocForm full-width submit, no maxWidth"
```

### Task 5.2: PotBorrowForm

**Files:**
- Modify: `src/app/(app)/charges/new/pot-borrow-form.tsx`

- [ ] **Step 1: Apply the same transformation as Task 5.1**

Find `maxWidth: 480` → remove. Replace `<Button type="submit" ...>` with `<SubmitButton type="submit" ...>`. Swap imports.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/charges/new/pot-borrow-form.tsx
git commit -m "feat(ui): PotBorrowForm full-width submit"
```

### Task 5.3: SplitForm (stacked rows + full-width submit)

**Files:**
- Modify: `src/app/(app)/charges/new/split-form.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useState } from 'react';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Checkbox } from 'baseui/checkbox';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useStyletron } from 'baseui';
import { createSplitCharge } from '@/server/actions/charges-server';
import { useMessages } from '@/app/_i18n-provider';
import { SubmitButton } from '@/ui/submit-button';
import { SMALL } from '@/ui/breakpoints';

type Member = { id: string; displayName: string };

export function SplitForm({ members }: { members: Member[] }) {
  const m = useMessages();
  const router = useRouter();
  const [css] = useStyletron();
  const [description, setDescription] = useState('');
  const [total, setTotal] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const totalDollars = parseFloat(total || '0');
  const perDefault = selectedIds.length > 0 ? Math.floor((totalDollars / selectedIds.length) * 100) / 100 : 0;

  const allocations = selectedIds.map((id) => ({
    userId: id,
    amount: overrides[id] ? overrides[id] : String(perDefault.toFixed(2)),
  }));

  const mut = useMutation({
    mutationFn: () =>
      createSplitCharge({
        description,
        allocations: allocations.map((a) => ({ userId: a.userId, amount: a.amount })),
      }),
    onSuccess: () => router.push('/charges'),
  });

  const rowCss = css({
    display: 'grid',
    gridTemplateColumns: '1fr 120px',
    gap: '12px',
    alignItems: 'center',
    padding: '6px 0',
    [SMALL]: {
      gridTemplateColumns: '1fr',
      gap: '6px',
    },
  });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <FormControl label={m.charges.descriptionLabel}>
        <Input value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
      </FormControl>
      <FormControl label={m.charges.totalAmountLabel}>
        <Input value={total} onChange={(e) => setTotal(e.currentTarget.value)} placeholder={m.charges.totalPlaceholder} />
      </FormControl>
      <div>
        <h4>{m.charges.membersSectionTitle}</h4>
        {members.map((mm) => {
          const checked = !!selected[mm.id];
          return (
            <div key={mm.id} className={rowCss}>
              <Checkbox checked={checked} onChange={(e) => setSelected((s) => ({ ...s, [mm.id]: e.currentTarget.checked }))}>
                {mm.displayName}
              </Checkbox>
              <Input
                disabled={!checked}
                placeholder={`${perDefault.toFixed(2)}`}
                value={overrides[mm.id] ?? ''}
                onChange={(e) => setOverrides((o) => ({ ...o, [mm.id]: e.currentTarget.value }))}
              />
            </div>
          );
        })}
      </div>
      <SubmitButton onClick={() => mut.mutate()} disabled={selectedIds.length === 0 || !description} isLoading={mut.isPending}>
        {m.charges.submitSplit}
      </SubmitButton>
      {mut.isError && <div style={{ color: '#dc2626' }}>{(mut.error as Error).message}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/charges/new/split-form.tsx
git commit -m "feat(ui): SplitForm rows stack on narrow"
```

### Task 5.4: NewChargeTabs — horizontal scroll for tab labels

**Files:**
- Modify: `src/app/(app)/charges/new/new-charge-tabs.tsx`

- [ ] **Step 1: Wrap the Tabs in an overflow-x container**

Replace the body:

```tsx
'use client';

import { Tabs, Tab, ORIENTATION } from 'baseui/tabs-motion';
import { useState } from 'react';
import { useMessages } from '@/app/_i18n-provider';
import { AdhocForm } from './adhoc-form';
import { PotBorrowForm } from './pot-borrow-form';
import { SplitForm } from './split-form';

type Member = { id: string; displayName: string };

export function NewChargeTabs({ members }: { members: Member[] }) {
  const m = useMessages();
  const [key, setKey] = useState<React.Key>('adhoc');
  return (
    <div style={{ overflowX: 'auto' }}>
      <Tabs activeKey={key} onChange={({ activeKey }) => setKey(activeKey)} orientation={ORIENTATION.horizontal}>
        <Tab key="adhoc" title={m.charges.tabAdhoc}>
          <AdhocForm members={members} />
        </Tab>
        <Tab key="split" title={m.charges.tabSplit}>
          <SplitForm members={members} />
        </Tab>
        <Tab key="pot_borrow" title={m.charges.tabPotBorrow}>
          <PotBorrowForm members={members} />
        </Tab>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/charges/new/new-charge-tabs.tsx
git commit -m "feat(ui): tab strip scrolls horizontally on narrow"
```

### Task 5.5: Payments record-form

**Files:**
- Modify: `src/app/(app)/payments/new/record-form.tsx`

- [ ] **Step 1: Drop `maxWidth` literals**

Find every occurrence of `maxWidth: 560` and `maxWidth: 640` in this file and delete the `, maxWidth: 560` / `, maxWidth: 640` text from the style objects.

- [ ] **Step 2: Wrap the allocations table in overflow-x**

Find the `<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>` and wrap it:

```tsx
<div style={{ overflowX: 'auto', marginTop: 8 }}>
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
    ...
  </table>
</div>
```

- [ ] **Step 3: Replace submit Buttons**

Both the member-branch submit and the guest-branch submit:

Find:

```tsx
        <Button
          type="button"
          onClick={() => submit.mutate()}
          isLoading={submit.isPending}
          disabled={submitDisabled}
        >
          {m.payments.submit}
        </Button>
```

Replace with:

```tsx
        <SubmitButton
          type="button"
          onClick={() => submit.mutate()}
          isLoading={submit.isPending}
          disabled={submitDisabled}
        >
          {m.payments.submit}
        </SubmitButton>
```

And the guest submit `<Button>` → `<SubmitButton>` similarly.

Add import:

```tsx
import { SubmitButton } from '@/ui/submit-button';
```

(Keep `Button, KIND, SIZE` import for the mode toggle which still uses non-submit buttons.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/payments/new/record-form.tsx
git commit -m "feat(ui): payments form mobile-friendly"
```

### Task 5.6: Spendings record-form

**Files:**
- Modify: `src/app/(app)/spendings/new/record-form.tsx`

- [ ] **Step 1: Drop `maxWidth: 480`**

Find:

```tsx
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
```

Replace with:

```tsx
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} style={{ display: 'grid', gap: 12 }}>
```

- [ ] **Step 2: Submit button**

Find:

```tsx
      <Button type="submit" isLoading={mut.isPending}>{m.spendings.submit}</Button>
```

Replace with:

```tsx
      <SubmitButton type="submit" isLoading={mut.isPending}>{m.spendings.submit}</SubmitButton>
```

Update imports: remove `Button`, add `SubmitButton`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/spendings/new/record-form.tsx
git commit -m "feat(ui): spendings form mobile-friendly"
```

### Task 5.7: Settings — DuesForm

**Files:**
- Modify: `src/app/(app)/settings/dues-form.tsx`

- [ ] **Step 1: Drop maxWidth and stack action buttons**

Find:

```tsx
    <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
```

Replace with:

```tsx
    <div style={{ display: 'grid', gap: 12 }}>
```

Find:

```tsx
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={() => save.mutate()} isLoading={save.isPending}>{m.settings.saveAmount}</Button>
        <Button onClick={() => run.mutate()} isLoading={run.isPending}>{m.settings.generateNow}</Button>
      </div>
```

Replace with:

```tsx
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => save.mutate()} isLoading={save.isPending} overrides={{ BaseButton: { style: { flex: 1 } } }}>{m.settings.saveAmount}</Button>
        <Button onClick={() => run.mutate()} isLoading={run.isPending} overrides={{ BaseButton: { style: { flex: 1 } } }}>{m.settings.generateNow}</Button>
      </div>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/dues-form.tsx
git commit -m "feat(ui): dues form mobile-friendly"
```

### Task 5.8: Settings — PotOpeningsForm

**Files:**
- Modify: `src/app/(app)/settings/pot-openings-form.tsx`

- [ ] **Step 1: Drop maxWidth and use SubmitButton**

Find:

```tsx
    <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
```

Replace with:

```tsx
    <div style={{ display: 'grid', gap: 12 }}>
```

Find:

```tsx
      <div>
        <Button onClick={() => save.mutate()} isLoading={save.isPending}>
          {m.settings.potOpeningsSave}
        </Button>
      </div>
```

Replace with:

```tsx
      <SubmitButton onClick={() => save.mutate()} isLoading={save.isPending}>
        {m.settings.potOpeningsSave}
      </SubmitButton>
```

Update imports: remove `Button` from `baseui/button`; add `import { SubmitButton } from '@/ui/submit-button';`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/pot-openings-form.tsx
git commit -m "feat(ui): pot-openings form mobile-friendly"
```

### Task 5.9: Member-detail charge-dues form

**Files:**
- Modify: `src/app/(app)/members/[id]/charge-dues-form.tsx`

- [ ] **Step 1: Stack field + button on narrow**

Replace the `<div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>` block. The flexWrap already wraps, so just adjust to make children full-width when wrapped:

Replace:

```tsx
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Controller
          control={control}
          name="period"
          render={({ field }) => (
            <FormControl label={m.members.dues.monthLabel}>
              <Input
                type="month"
                value={field.value}
                onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
              />
            </FormControl>
          )}
        />
        <Button type="submit" isLoading={mutation.isPending}>
          {m.members.dues.chargeButton(formatCents(monthlyDuesAmount))}
        </Button>
      </div>
```

With:

```tsx
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Controller
            control={control}
            name="period"
            render={({ field }) => (
              <FormControl label={m.members.dues.monthLabel}>
                <Input
                  type="month"
                  value={field.value}
                  onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                />
              </FormControl>
            )}
          />
        </div>
        <Button type="submit" isLoading={mutation.isPending} overrides={{ BaseButton: { style: { flex: '1 1 200px' } } }}>
          {m.members.dues.chargeButton(formatCents(monthlyDuesAmount))}
        </Button>
      </div>
```

- [ ] **Step 2: Typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/members/\[id\]/charge-dues-form.tsx
git commit -m "feat(ui): charge-dues form wraps on narrow"
```

### Task 5.10: AdminControls — full-width buttons on narrow

**Files:**
- Modify: `src/app/(app)/members/[id]/admin-controls.tsx`

- [ ] **Step 1: Update the wrapping div and individual button overrides**

Find:

```tsx
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        kind={KIND.secondary}
        onClick={() => {
          reset({ displayName: user.displayName, role: user.role });
          setEditOpen(true);
        }}
      >
        {m.common.edit}
      </Button>
```

Replace with (top of return, before the `<div>`):

```tsx
  const [css] = useStyletron();
  const btnContainer = css({
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    [SMALL]: { width: '100%' },
  });
  const fullOnSmall = {
    BaseButton: {
      style: {
        [SMALL]: { flex: '1 1 0', width: '100%' },
      } as Record<string, unknown>,
    },
  };
```

Then change the outer `<div style={{...}}>` to `<div className={btnContainer}>`, and add `overrides={fullOnSmall}` to each `<Button>` in this row (Edit, Deactivate/Reactivate, Delete).

Add imports:

```tsx
import { useStyletron } from 'baseui';
import { SMALL } from '@/ui/breakpoints';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/members/\[id\]/admin-controls.tsx
git commit -m "feat(ui): AdminControls buttons span row on narrow"
```

---

## Phase 6 — Guest deposits matrix + login + mini polish

### Task 6.1: Guest deposits matrix overflow

**Files:**
- Modify: `src/app/(app)/guests/deposits/matrix.tsx`

- [ ] **Step 1: Read the file**

Run: `cat src/app/\(app\)/guests/deposits/matrix.tsx | head -80`

- [ ] **Step 2: Find the outermost grid wrapper** (the element that contains the column headers and rows). Wrap it in `<div style={{ overflowX: 'auto' }}>...</div>` — same pattern as `MoneyHistory` uses with its `scrollRef` wrapper.

If the matrix is already inside an `overflow-x: auto` wrapper, skip. Otherwise add it as the outermost element of the returned JSX (preserving whatever ref/handlers exist on the inner grid).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/guests/deposits/matrix.tsx
git commit -m "feat(ui): guest-deposits matrix scrolls horizontally"
```

### Task 6.2: Login page polish

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { env } from '@/server/env';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { LanguageSwitcher } from '@/app/_language-switcher';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const e = env();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        gap: '24px',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher />
      </div>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 8 }}>{m.auth.loginTitle}</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>{m.auth.loginSubtitle}</p>
        <div
          dangerouslySetInnerHTML={{
            __html: `
            <script async src="https://telegram.org/js/telegram-widget.js?22"
              data-telegram-login="${e.BOT_USERNAME}"
              data-size="large"
              data-auth-url="${e.NEXT_PUBLIC_BASE_URL}/api/auth/telegram/callback"
              data-request-access="write"></script>
          `,
          }}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(ui): login page centered + language switcher"
```

### Task 6.3: Verify viewport meta in root layout

**Files:**
- Modify (conditionally): `src/app/layout.tsx`

- [ ] **Step 1: Check Next.js default**

Read `src/app/layout.tsx`. Next 14 sets a default viewport but only when an explicit `viewport` or `metadata.viewport` is not configured. To be explicit, add:

```tsx
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};
```

Insert above `export async function generateMetadata`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): explicit viewport meta width=device-width"
```

### Task 6.4: Mini tap targets — mini-row

**Files:**
- Modify: `src/app/(mini)/_components/mini-row.tsx`

- [ ] **Step 1: Read it, then ensure rows have `min-height: 48px`**

Run: `cat src/app/\(mini\)/_components/mini-row.tsx`

In the styled row element, ensure the styles include `minHeight: '48px'` and `padding` has `≥ 12px` vertical. If a smaller variant exists, gate `minHeight` behind the interactive (`href` truthy) case.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(mini\)/_components/mini-row.tsx
git commit -m "feat(mini): row min-height 48px for tap target"
```

### Task 6.5: Mini tap targets — locale-chip

**Files:**
- Modify: `src/app/(mini)/_components/locale-chip.tsx`

- [ ] **Step 1: Read**

Run: `cat src/app/\(mini\)/_components/locale-chip.tsx`

- [ ] **Step 2: Set the chip's minimum height and padding**

Add `minHeight: '40px'` and ensure `padding: '8px 12px'` (or equivalent).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(mini\)/_components/locale-chip.tsx
git commit -m "feat(mini): locale-chip min-height 40px"
```

### Task 6.6: Mini tap targets — tabs + charges filter chips

**Files:**
- Modify: `src/app/(mini)/mini/tabs.tsx`
- Modify: `src/app/(mini)/mini/charges/page.tsx`

- [ ] **Step 1: tabs.tsx**

Read: `cat src/app/\(mini\)/mini/tabs.tsx`. Wrap the strip in `<div style={{ overflowX: 'auto' }}>` if not already. Set each tab's `min-height: 44px`.

- [ ] **Step 2: charges/page.tsx — filter chips**

Read: `cat src/app/\(mini\)/mini/charges/page.tsx`. Find the filter-chip elements (Link-styled chips above the list). Set `min-height: 40px` and adequate padding.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(mini\)/mini/tabs.tsx src/app/\(mini\)/mini/charges/page.tsx
git commit -m "feat(mini): tab and filter-chip tap targets"
```

---

## Phase 7 — Verification

### Task 7.1: Full typecheck + test suite

- [ ] **Step 1: Run**

```bash
pnpm typecheck && pnpm test
```

Expected: PASS for both. The test suite is `tests/**/*.test.ts` (Vitest, node environment), exercising domain/actions/jobs/bot/integration — none of which we changed. Any failure means we accidentally broke a shared type or import path.

- [ ] **Step 2: If anything fails**

Read the error, fix the offending file, re-run. Do not commit until both pass.

### Task 7.2: Run the dev server and manually walk the mobile flow

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

The server runs on `http://localhost:3000`.

- [ ] **Step 2: Open Chrome DevTools mobile emulation**

In Chrome: F12 → toggle device toolbar (Ctrl+Shift+M) → choose "iPhone 14 Pro" or set viewport to 390×844. (Or use an actual phone via the Cloudflare Tunnel URL.)

- [ ] **Step 3: Walk the path and verify each**

For each, confirm: layout is not horizontally scrolling unintentionally, tap targets feel ≥44px, no text clipped, no overlapping elements:
- `/login` — title + subtitle visible; language switcher top-right; Telegram widget rendered.
- (Log in.) `/dashboard` — pots stacked, members list as cards, "View money history" link.
- Tap "View money history" → `/dashboard/history` — `MoneyHistory` renders with header that wraps; the wide grid scrolls horizontally inside the panel.
- Back. Tap a member card → `/members/{id}` — page header wraps, admin controls each span the row on narrow.
- Tap hamburger (top-left). Drawer opens. Tap each link in turn — verify the drawer closes and the route changes. Active route is highlighted in subsequent opens.
- `/charges` — cards with type · when subtitle, status badge, action buttons full-width across the card footer when both PayFromCredit and Cancel are present.
- `/payments` — cards with payer name + method · when subtitle. Cancel button (admin) wraps full-width.
- `/spendings` — cards. Cancel button (admin) wraps.
- `/guests` — cards with Rename + Archive buttons side-by-side.
- `/charges/new` — form fields stack, tabs scroll horizontally if needed, submit is full-width.
- `/payments/new` — payer/method/amount/note stack; allocations sub-block scrolls horizontally; submit full-width.
- `/spendings/new` — same.
- `/settings` — dues form input + buttons; pot-openings input + button. Buttons stack/full-width.
- `/info` — content readable, no horizontal scroll.

- [ ] **Step 4: Test the `/mini` polish**

Visit `/mini` (you'll need a Telegram initData session OR you can mock — the surface is normally accessed via the Telegram Mini App). On the dev server you can skip if it requires Telegram; the changes are purely CSS additions.

- [ ] **Step 5: Stop the dev server**

Ctrl+C.

### Task 7.3: Final commit (only if a fix was needed during verification)

If verification surfaced any issues you had to patch, commit those fixes with descriptive messages. If everything was green, skip.

---

## Self-Review

**Spec coverage:**
- App shell (sticky bar + drawer + 720px content) → Tasks 2.1–2.3 ✓
- `DataList` / `DataCard` primitives → Task 1.3 ✓
- All listing pages converted → Tasks 3.1–3.7 ✓
- Dashboard restructure + `/dashboard/history` → Tasks 4.1–4.3 ✓
- `MoneyHistory` header wrapping → Task 4.2 ✓
- `PageHeader` wrapping → Task 1.4 ✓
- `AdminControls` full-width on narrow → Task 5.10 ✓
- All forms (adhoc, pot-borrow, split, new-charge-tabs, payments, spendings, dues, pot-openings, charge-dues) → Tasks 5.1–5.9 ✓
- `SubmitButton` helper → Task 1.2 ✓
- Breakpoint token → Task 1.1 ✓
- New i18n keys → Task 1.5 ✓
- Login page → Task 6.2 ✓
- Viewport meta → Task 6.3 ✓
- Guest deposits matrix → Task 6.1 ✓
- Mini polish (row, chip, tabs, filter) → Tasks 6.4–6.6 ✓
- Verification → Task 7.x ✓

**Placeholder scan:** None — all steps have concrete code or commands.

**Type consistency:** `DataCard`, `DataList`, `SubmitButton`, `AppShell` signatures match across all consumers. `SMALL` constant used consistently from `@/ui/breakpoints`.
