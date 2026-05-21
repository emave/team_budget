# Mini App Translate & Enhance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Telegram Mini App at `/mini` feel Telegram-native (theme + haptics), fully localized (seed locale from Telegram, in-app RU/EN toggle, no raw English strings), and useful at a glance (richer Home, filterable Charges, Markdown Info).

**Architecture:** Server components in `src/app/(mini)/mini/**` already render via `getMessages(locale)`. We add a shared primitives folder, replace inline hex with CSS variables driven by `Telegram.WebApp.themeParams`, seed `users.locale` from `initData.user.language_code` in the existing mini-auth route, expose an in-mini `LocaleChip` that calls the existing `setMyLocale` server action, and swap the Info `<pre>` for `react-markdown`. No new server domain functions — `listChargesFiltered` and `listPaymentsByPayer` already exist.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Drizzle ORM, better-sqlite3, Vitest, `react-markdown` (new dep), Telegram WebApp JS.

**Reference spec:** [docs/superpowers/specs/2026-05-21-mini-app-translate-enhance-design.md](../specs/2026-05-21-mini-app-translate-enhance-design.md)

---

## File Structure

**New files:**
- `src/app/(mini)/_components/mini.css` — CSS variable defaults + semantic palette + `[data-tg-scheme="dark"]` overrides.
- `src/app/(mini)/_components/mini-card.tsx` — presentational `<MiniCard>` (light + variants).
- `src/app/(mini)/_components/mini-row.tsx` — `<MiniRow>` flex layout with `left`, `right`, optional `subtitle`.
- `src/app/(mini)/_components/mini-badge.tsx` — `<MiniBadge variant>` pill.
- `src/app/(mini)/_components/mini-section.tsx` — heading + spacing wrapper.
- `src/app/(mini)/_components/mini-empty.tsx` — empty-state.
- `src/app/(mini)/_components/mini-header.tsx` — server: brand + `<LocaleChip>`.
- `src/app/(mini)/_components/locale-chip.tsx` — `'use client'`: RU/EN toggle that calls `setMyLocale`.
- `src/app/(mini)/_components/markdown.tsx` — `'use client'`: `react-markdown` wrapper.
- `src/server/auth/seed-locale.ts` — pure `seedLocaleIfMissing(db, user, languageCode)`.
- `tests/auth/seed-locale.test.ts` — unit tests for the seeding helper.
- `tests/shared/mini-charges-filter.test.ts` — unit tests for `parseChargesStatusParam`.
- `src/app/(mini)/mini/charges/filter.ts` — `parseChargesStatusParam(value: unknown)` helper (pure, importable from tests).

**Modified files:**
- `src/server/auth/telegram.ts` — extend `MiniAppUser` with `language_code?: string`.
- `src/app/api/auth/telegram/mini/route.ts` — seed locale via `seedLocaleIfMissing`, write `tb_locale` cookie.
- `src/app/(mini)/layout.tsx` — import `mini.css`, render `<MiniHeader>` above children.
- `src/app/(mini)/mini/init.tsx` — write theme params to `:root`, set `data-tg-scheme`, no more forced white.
- `src/app/(mini)/mini/tabs.tsx` — switch to CSS-var styling, fire `HapticFeedback.impactOccurred('light')` on click.
- `src/app/(mini)/mini/auth-gate.tsx` — use CSS-var styling, no inline hex.
- `src/app/(mini)/mini/page.tsx` — Home: big debt card via `<MiniCard>`, admin pots as two cards, new "Recent" section.
- `src/app/(mini)/mini/charges/page.tsx` — filters, date + type chip + status pill via primitives.
- `src/app/(mini)/mini/payments/page.tsx` — localized method label via `<MiniRow>`.
- `src/app/(mini)/mini/info/page.tsx` — render body via `<Markdown>`.
- `package.json` + `pnpm-lock.yaml` — add `react-markdown`.

**Deleted files:** none.

---

## Conventions

- All money: `formatCents(amount)`.
- All dates: `formatDate(dateOrIso, locale)` from `@/shared/i18n`.
- Filenames: kebab-case. React components: PascalCase. CSS classes: `mini-*` prefix.
- No new inline hex in any mini-app component except where explicitly listed in `mini.css` semantic tokens.
- Frequent commits — one per task (or one per sub-step when noted).

---

## Task 1: CSS variable foundation

**Files:**
- Create: `src/app/(mini)/_components/mini.css`
- Modify: `src/app/(mini)/layout.tsx`
- Modify: `src/app/(mini)/mini/init.tsx`

- [ ] **Step 1.1: Create `mini.css`**

```css
/* src/app/(mini)/_components/mini.css */
:root {
  /* Telegram theme — overwritten by MiniInit when running inside Telegram. */
  --mini-bg: #ffffff;
  --mini-text: #111827;
  --mini-hint: #6b7280;
  --mini-link: #2563eb;
  --mini-button: #16a34a;
  --mini-button-text: #ffffff;
  --mini-section-bg: #f9fafb;

  /* Semantic palette — meaning-bearing, intentionally NOT theme-derived. */
  --mini-success-bg: #ecfdf5;
  --mini-success-fg: #166534;
  --mini-warn-bg: #fffbeb;
  --mini-warn-fg: #92400e;
  --mini-danger-bg: #fef2f2;
  --mini-danger-fg: #991b1b;
  --mini-neutral-bg: #f3f4f6;
  --mini-neutral-fg: #374151;

  --mini-border: rgba(0, 0, 0, 0.08);
  --mini-radius: 10px;
}

[data-tg-scheme="dark"] {
  --mini-success-bg: rgba(34, 197, 94, 0.18);
  --mini-success-fg: #86efac;
  --mini-warn-bg: rgba(245, 158, 11, 0.18);
  --mini-warn-fg: #fbbf24;
  --mini-danger-bg: rgba(220, 38, 38, 0.18);
  --mini-danger-fg: #fca5a5;
  --mini-neutral-bg: rgba(255, 255, 255, 0.06);
  --mini-neutral-fg: #d1d5db;
  --mini-border: rgba(255, 255, 255, 0.10);
}

body {
  background: var(--mini-bg);
  color: var(--mini-text);
}

.mini-card {
  background: var(--mini-section-bg);
  border-radius: var(--mini-radius);
  padding: 14px 14px;
}
.mini-card--debt { background: var(--mini-danger-bg); color: var(--mini-danger-fg); }
.mini-card--settled { background: var(--mini-success-bg); color: var(--mini-success-fg); }

.mini-section { margin-bottom: 16px; }
.mini-section__heading { font-size: 14px; font-weight: 600; color: var(--mini-hint); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 8px; }

.mini-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 4px; border-top: 1px solid var(--mini-border); font-size: 14px; }
.mini-row:first-child { border-top: none; }
.mini-row__left { display: flex; flex-direction: column; min-width: 0; }
.mini-row__title { color: var(--mini-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini-row__subtitle { color: var(--mini-hint); font-size: 12px; margin-top: 2px; display: flex; gap: 6px; align-items: center; }
.mini-row__right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }

.mini-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; line-height: 1.5; font-weight: 500; }
.mini-badge--success { background: var(--mini-success-bg); color: var(--mini-success-fg); }
.mini-badge--warn    { background: var(--mini-warn-bg);    color: var(--mini-warn-fg); }
.mini-badge--danger  { background: var(--mini-danger-bg);  color: var(--mini-danger-fg); }
.mini-badge--neutral { background: var(--mini-neutral-bg); color: var(--mini-neutral-fg); }

.mini-empty { color: var(--mini-hint); padding: 16px 4px; text-align: center; font-size: 13px; }

.mini-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 14px; }
.mini-header__brand { font-weight: 600; font-size: 15px; color: var(--mini-text); }

.mini-locale-chip { display: inline-flex; border: 1px solid var(--mini-border); border-radius: 999px; overflow: hidden; }
.mini-locale-chip button { background: transparent; border: none; padding: 4px 10px; font-size: 12px; font-weight: 600; color: var(--mini-hint); cursor: pointer; }
.mini-locale-chip button[data-active="true"] { background: var(--mini-button); color: var(--mini-button-text); }

.mini-tabs { position: fixed; bottom: 0; left: 0; right: 0; background: var(--mini-bg); border-top: 1px solid var(--mini-border); padding: 8px 0; }
.mini-tabs__link { text-align: center; color: var(--mini-hint); font-size: 13px; text-decoration: none; }
.mini-tabs__link[data-active="true"] { color: var(--mini-button); font-weight: 600; }

.mini-filterbar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.mini-filterbar a { padding: 4px 10px; border-radius: 999px; font-size: 12px; text-decoration: none; color: var(--mini-hint); background: var(--mini-neutral-bg); }
.mini-filterbar a[data-active="true"] { background: var(--mini-button); color: var(--mini-button-text); }

.mini-markdown { font-size: 14px; line-height: 1.5; color: var(--mini-text); }
.mini-markdown h1, .mini-markdown h2, .mini-markdown h3, .mini-markdown h4 { margin: 12px 0 6px; }
.mini-markdown p { margin: 6px 0; }
.mini-markdown ul, .mini-markdown ol { padding-left: 20px; margin: 6px 0; }
.mini-markdown code { background: var(--mini-neutral-bg); padding: 1px 4px; border-radius: 4px; font-size: 12.5px; }
.mini-markdown pre { background: var(--mini-neutral-bg); padding: 8px; border-radius: 6px; overflow-x: auto; font-size: 12.5px; }
.mini-markdown a { color: var(--mini-link); }
.mini-markdown blockquote { border-left: 3px solid var(--mini-border); padding-left: 10px; color: var(--mini-hint); margin: 6px 0; }
```

- [ ] **Step 1.2: Import the stylesheet in the mini layout**

Modify `src/app/(mini)/layout.tsx`. Replace the entire file with:

```tsx
import type { ReactNode } from 'react';
import Script from 'next/script';
import { getCurrentUser } from '@/server/auth/server-helpers';
import { bootOnce } from '@/server/boot';
import { MiniAuthGate } from './mini/auth-gate';
import { MiniHeader } from './_components/mini-header';
import './_components/mini.css';

export default async function MiniLayout({ children }: { children: ReactNode }) {
  await bootOnce();
  const user = await getCurrentUser();
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?56" strategy="beforeInteractive" />
      {user ? (
        <main style={{ padding: 12, maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>
          <MiniHeader />
          {children}
        </main>
      ) : (
        <MiniAuthGate />
      )}
    </>
  );
}
```

Note: `<MiniHeader />` doesn't exist yet — it's added in Task 2. The file will not type-check between tasks; that's fine — we commit at the end of each task as a unit.

- [ ] **Step 1.3: Drop the forced white in `MiniInit` and apply theme to `:root`**

Replace `src/app/(mini)/mini/init.tsx` with:

```tsx
'use client';

import { useEffect } from 'react';

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  HapticFeedback?: { impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void };
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
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
```

- [ ] **Step 1.4: Verify the app still builds**

Run: `pnpm typecheck`
Expected: errors only about the missing `MiniHeader` import — we resolve that in Task 2. **Do not commit yet** — proceed straight to Task 2.

---

## Task 2: Header + locale chip + locale seeding

**Files:**
- Create: `src/app/(mini)/_components/mini-header.tsx`
- Create: `src/app/(mini)/_components/locale-chip.tsx`
- Create: `src/server/auth/seed-locale.ts`
- Create: `tests/auth/seed-locale.test.ts`
- Modify: `src/server/auth/telegram.ts`
- Modify: `src/app/api/auth/telegram/mini/route.ts`

- [ ] **Step 2.1: Write the failing test for the locale-seeding helper**

Create `tests/auth/seed-locale.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser, getUserByTelegramId } from '@/server/domain/users';
import { seedLocaleIfMissing } from '@/server/auth/seed-locale';

describe('seedLocaleIfMissing', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('writes ru when user has no locale and language_code is "ru"', async () => {
    const u = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'member', locale: null });
    const next = await seedLocaleIfMissing(db, u, 'ru');
    expect(next.locale).toBe('ru');
    const reread = await getUserByTelegramId(db, 1);
    expect(reread?.locale).toBe('ru');
  });

  it('writes en when language_code is "en-US"', async () => {
    const u = await createUser(db, { telegramUserId: 2, displayName: 'B', role: 'member', locale: null });
    const next = await seedLocaleIfMissing(db, u, 'en-US');
    expect(next.locale).toBe('en');
  });

  it('does not overwrite an existing locale', async () => {
    const u = await createUser(db, { telegramUserId: 3, displayName: 'C', role: 'member', locale: 'en' });
    const next = await seedLocaleIfMissing(db, u, 'ru');
    expect(next.locale).toBe('en');
  });

  it('falls back to default when language_code is missing or unknown', async () => {
    const u = await createUser(db, { telegramUserId: 4, displayName: 'D', role: 'member', locale: null });
    const next = await seedLocaleIfMissing(db, u, undefined);
    // No write — user keeps null locale, helper returns user as-is.
    expect(next.locale).toBeNull();
    const next2 = await seedLocaleIfMissing(db, u, 'zh');
    expect(next2.locale).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run the test — expect failure**

Run: `pnpm vitest run tests/auth/seed-locale.test.ts`
Expected: FAIL — `seedLocaleIfMissing` doesn't exist.

- [ ] **Step 2.3: Implement `seedLocaleIfMissing`**

Create `src/server/auth/seed-locale.ts`:

```ts
import 'server-only';
import type { Db } from '@/server/domain/types';
import { updateUserLocale } from '@/server/domain/users';
import { detectFromTelegram, isLocale } from '@/shared/i18n';

type UserRow = { id: string; locale: 'en' | 'ru' | null };

export async function seedLocaleIfMissing<U extends UserRow>(
  db: Db,
  user: U,
  languageCode: string | undefined | null,
): Promise<U> {
  if (user.locale) return user;
  if (!languageCode) return user;
  const candidate = detectFromTelegram(languageCode);
  // detectFromTelegram never returns a non-Locale value, but guard anyway.
  if (!isLocale(candidate)) return user;
  // Only seed when the language_code clearly matches a supported locale prefix.
  const prefix = languageCode.toLowerCase().split('-')[0];
  if (prefix !== 'ru' && prefix !== 'en') return user;
  await updateUserLocale(db, user.id, candidate);
  return { ...user, locale: candidate };
}
```

- [ ] **Step 2.4: Run the test — expect pass**

Run: `pnpm vitest run tests/auth/seed-locale.test.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 2.5: Extend `MiniAppUser` with `language_code`**

Modify `src/server/auth/telegram.ts` lines 42–48. Replace the `MiniAppUser` interface with:

```ts
export interface MiniAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}
```

- [ ] **Step 2.6: Update the mini auth route to seed locale + cookie**

Modify `src/app/api/auth/telegram/mini/route.ts`. Replace the whole file with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/server/env';
import { verifyMiniAppInitData } from '@/server/auth/telegram';
import { signCookie } from '@/server/auth/session-cookie';
import { getDb } from '@/server/db/client';
import { getUserByTelegramId } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { syncAdminCommandsForUser } from '@/server/bot/admin-commands';
import { seedLocaleIfMissing } from '@/server/auth/seed-locale';
import { DEFAULT_LOCALE } from '@/shared/i18n';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const initData = body && typeof body.initData === 'string' ? body.initData : '';
  if (!initData) {
    return new NextResponse('missing initData', { status: 400 });
  }

  const e = env();
  const verify = verifyMiniAppInitData(initData, e.BOT_TOKEN);
  if (!verify.ok) {
    return new NextResponse(`Auth failed: ${verify.reason}`, { status: 401 });
  }

  const db = getDb();
  let user = await getUserByTelegramId(db, verify.user.id);
  if (!user && verify.user.id === e.BOOTSTRAP_ADMIN_TELEGRAM_ID) {
    await bootstrapAdminIfNeeded(db, {
      telegramUserId: verify.user.id,
      displayName:
        [verify.user.first_name, verify.user.last_name].filter(Boolean).join(' ') ||
        verify.user.username ||
        'Admin',
      telegramUsername: verify.user.username ?? null,
      photoUrl: verify.user.photo_url ?? null,
    });
    user = await getUserByTelegramId(db, verify.user.id);
    if (user) await syncAdminCommandsForUser(user);
  }
  if (!user) {
    return new NextResponse('Not a team member', { status: 403 });
  }

  user = await seedLocaleIfMissing(db, user, verify.user.language_code);

  const session = await createSession(db, user.id);
  const cookieValue = signCookie(session.token, e.SESSION_SECRET);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('tb_session', cookieValue, {
    httpOnly: true,
    secure: e.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.expiresAt),
  });
  res.cookies.set('tb_locale', user.locale ?? DEFAULT_LOCALE, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
```

- [ ] **Step 2.7: Build `LocaleChip` (client) and `MiniHeader` (server)**

Create `src/app/(mini)/_components/locale-chip.tsx`:

```tsx
'use client';

import { useTransition } from 'react';
import { useLocale } from '@/app/_i18n-provider';
import type { Locale } from '@/shared/i18n';
import { setMyLocale } from '@/server/actions/i18n-server';

export function LocaleChip() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const flip = (next: Locale) => () => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setMyLocale({ locale: next });
      window.location.reload();
    });
  };

  return (
    <div className="mini-locale-chip" aria-label="Language">
      <button type="button" onClick={flip('ru')} data-active={locale === 'ru'} disabled={pending}>RU</button>
      <button type="button" onClick={flip('en')} data-active={locale === 'en'} disabled={pending}>EN</button>
    </div>
  );
}
```

Create `src/app/(mini)/_components/mini-header.tsx`:

```tsx
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { LocaleChip } from './locale-chip';

export async function MiniHeader() {
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <header className="mini-header">
      <span className="mini-header__brand">{m.brand}</span>
      <LocaleChip />
    </header>
  );
}
```

- [ ] **Step 2.8: Typecheck + run all tests**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS. The i18n catalog parity test still passes (no key changes yet).

- [ ] **Step 2.9: Commit**

```bash
git add src/app/(mini)/_components/mini.css \
        src/app/(mini)/_components/mini-header.tsx \
        src/app/(mini)/_components/locale-chip.tsx \
        src/app/(mini)/layout.tsx \
        src/app/(mini)/mini/init.tsx \
        src/server/auth/telegram.ts \
        src/server/auth/seed-locale.ts \
        src/app/api/auth/telegram/mini/route.ts \
        tests/auth/seed-locale.test.ts
git commit -m "$(cat <<'EOF'
feat(mini): Telegram theme vars + locale seeding + in-mini RU/EN chip

- :root CSS variables driven by Telegram.WebApp.themeParams (drops forced white)
- Mini layout imports mini.css and renders MiniHeader with LocaleChip
- New /api/auth/telegram/mini seeds users.locale from initData.user.language_code
  via seedLocaleIfMissing (unit-tested), and sets the tb_locale cookie so the
  immediately-following reload renders in the new language

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Primitives (`MiniCard`, `MiniRow`, `MiniBadge`, `MiniSection`, `MiniEmpty`)

**Files:**
- Create: `src/app/(mini)/_components/mini-card.tsx`
- Create: `src/app/(mini)/_components/mini-row.tsx`
- Create: `src/app/(mini)/_components/mini-badge.tsx`
- Create: `src/app/(mini)/_components/mini-section.tsx`
- Create: `src/app/(mini)/_components/mini-empty.tsx`

- [ ] **Step 3.1: `MiniCard`**

```tsx
// src/app/(mini)/_components/mini-card.tsx
import type { ReactNode, CSSProperties } from 'react';

type Variant = 'default' | 'debt' | 'settled';

export function MiniCard({
  children,
  variant = 'default',
  style,
}: {
  children: ReactNode;
  variant?: Variant;
  style?: CSSProperties;
}) {
  const cls = 'mini-card' + (variant === 'debt' ? ' mini-card--debt' : variant === 'settled' ? ' mini-card--settled' : '');
  return <div className={cls} style={style}>{children}</div>;
}
```

- [ ] **Step 3.2: `MiniRow`**

```tsx
// src/app/(mini)/_components/mini-row.tsx
import type { ReactNode } from 'react';

export function MiniRow({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mini-row">
      <div className="mini-row__left">
        <span className="mini-row__title">{title}</span>
        {subtitle && <span className="mini-row__subtitle">{subtitle}</span>}
      </div>
      {right && <div className="mini-row__right">{right}</div>}
    </div>
  );
}
```

- [ ] **Step 3.3: `MiniBadge`**

```tsx
// src/app/(mini)/_components/mini-badge.tsx
import type { ReactNode } from 'react';

export function MiniBadge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: 'success' | 'warn' | 'danger' | 'neutral';
}) {
  return <span className={`mini-badge mini-badge--${variant}`}>{children}</span>;
}
```

- [ ] **Step 3.4: `MiniSection`**

```tsx
// src/app/(mini)/_components/mini-section.tsx
import type { ReactNode } from 'react';

export function MiniSection({ heading, children }: { heading?: ReactNode; children: ReactNode }) {
  return (
    <section className="mini-section">
      {heading && <h2 className="mini-section__heading">{heading}</h2>}
      {children}
    </section>
  );
}
```

- [ ] **Step 3.5: `MiniEmpty`**

```tsx
// src/app/(mini)/_components/mini-empty.tsx
import type { ReactNode } from 'react';

export function MiniEmpty({ children }: { children: ReactNode }) {
  return <div className="mini-empty">{children}</div>;
}
```

- [ ] **Step 3.6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3.7: Commit**

```bash
git add src/app/(mini)/_components/mini-card.tsx \
        src/app/(mini)/_components/mini-row.tsx \
        src/app/(mini)/_components/mini-badge.tsx \
        src/app/(mini)/_components/mini-section.tsx \
        src/app/(mini)/_components/mini-empty.tsx
git commit -m "$(cat <<'EOF'
feat(mini): shared presentational primitives

MiniCard (default | debt | settled variants), MiniRow (title/subtitle/right),
MiniBadge (success | warn | danger | neutral), MiniSection (heading wrapper),
MiniEmpty (centered hint-colored empty state).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Tabs styled via CSS vars + haptics

**Files:**
- Modify: `src/app/(mini)/mini/tabs.tsx`

- [ ] **Step 4.1: Replace `tabs.tsx`**

```tsx
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
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch { /* ignore */ }
  };
  return (
    <nav className="mini-tabs" style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
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
```

- [ ] **Step 4.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add src/app/(mini)/mini/tabs.tsx
git commit -m "$(cat <<'EOF'
feat(mini): theme-aware tabs + light haptic on tab tap

Replaces inline color literals with CSS variables and fires
Telegram.WebApp.HapticFeedback.impactOccurred('light') on tap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Auth gate restyle

**Files:**
- Modify: `src/app/(mini)/mini/auth-gate.tsx`

- [ ] **Step 5.1: Replace `auth-gate.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useMessages } from '@/app/_i18n-provider';

type State = 'init' | 'authing' | 'error' | 'no-telegram';

export function MiniAuthGate() {
  const m = useMessages();
  const [state, setState] = useState<State>('init');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initData) {
      setState('no-telegram');
      return;
    }
    setState('authing');
    fetch('/api/auth/telegram/mini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    })
      .then(async (res) => {
        if (res.ok) {
          window.location.reload();
        } else {
          const text = await res.text();
          setState('error');
          setMsg(text || `HTTP ${res.status}`);
        }
      })
      .catch((err: unknown) => {
        setState('error');
        setMsg(err instanceof Error ? err.message : String(err));
      });
  }, []);

  return (
    <main style={{ padding: 24, textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      {state === 'no-telegram' && (
        <>
          <h2 style={{ marginBottom: 8, color: 'var(--mini-text)' }}>{m.mini.openInTelegramTitle}</h2>
          <p style={{ color: 'var(--mini-hint)' }}>{m.mini.openInTelegramBody}</p>
        </>
      )}
      {(state === 'init' || state === 'authing') && (
        <p style={{ color: 'var(--mini-hint)' }}>{m.mini.signingIn}</p>
      )}
      {state === 'error' && (
        <>
          <h2 style={{ marginBottom: 8, color: 'var(--mini-text)' }}>{m.mini.signInFailed}</h2>
          <p style={{ color: 'var(--mini-danger-fg)' }}>{msg}</p>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/app/(mini)/mini/auth-gate.tsx
git commit -m "$(cat <<'EOF'
feat(mini): auth gate uses theme vars

No more hardcoded #666/#b91c1c; pulls from --mini-hint / --mini-text /
--mini-danger-fg so the gate renders correctly on dark Telegram themes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Charges status filter helper + page rewrite

**Files:**
- Create: `src/app/(mini)/mini/charges/filter.ts`
- Create: `tests/shared/mini-charges-filter.test.ts`
- Modify: `src/app/(mini)/mini/charges/page.tsx`

- [ ] **Step 6.1: Write the failing test**

Create `tests/shared/mini-charges-filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseChargesStatusParam } from '@/app/(mini)/mini/charges/filter';

describe('parseChargesStatusParam', () => {
  it('returns undefined for nullish / "all"', () => {
    expect(parseChargesStatusParam(undefined)).toBeUndefined();
    expect(parseChargesStatusParam(null)).toBeUndefined();
    expect(parseChargesStatusParam('all')).toBeUndefined();
    expect(parseChargesStatusParam('')).toBeUndefined();
  });

  it('returns the value for known statuses', () => {
    expect(parseChargesStatusParam('open')).toBe('open');
    expect(parseChargesStatusParam('paid')).toBe('paid');
    expect(parseChargesStatusParam('cancelled')).toBe('cancelled');
  });

  it('returns undefined for unknown values', () => {
    expect(parseChargesStatusParam('foo')).toBeUndefined();
    expect(parseChargesStatusParam(42)).toBeUndefined();
    expect(parseChargesStatusParam(['open'])).toBeUndefined();
  });
});
```

- [ ] **Step 6.2: Run test — expect failure**

Run: `pnpm vitest run tests/shared/mini-charges-filter.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 6.3: Implement helper**

Create `src/app/(mini)/mini/charges/filter.ts`:

```ts
export type ChargeStatus = 'open' | 'paid' | 'cancelled';

export function parseChargesStatusParam(value: unknown): ChargeStatus | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === 'open' || value === 'paid' || value === 'cancelled') return value;
  return undefined;
}
```

- [ ] **Step 6.4: Run test — expect pass**

Run: `pnpm vitest run tests/shared/mini-charges-filter.test.ts`
Expected: PASS.

- [ ] **Step 6.5: Rewrite charges page**

Replace `src/app/(mini)/mini/charges/page.tsx`:

```tsx
import Link from 'next/link';
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered } from '@/server/domain/charges';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages, type Messages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniEmpty } from '../../_components/mini-empty';
import { parseChargesStatusParam, type ChargeStatus } from './filter';

const STATUS_LABEL_KEYS: Record<ChargeStatus, keyof Messages['charges']> = {
  open: 'statusOpen',
  paid: 'statusPaid',
  cancelled: 'statusCancelled',
};

const STATUS_VARIANT: Record<ChargeStatus, 'warn' | 'success' | 'neutral'> = {
  open: 'warn',
  paid: 'success',
  cancelled: 'neutral',
};

const TYPE_LABEL_KEYS: Record<string, keyof Messages['charges']> = {
  adhoc: 'typeAdhoc',
  split: 'typeSplit',
  pot_borrow: 'typePotBorrow',
  monthly_dues: 'typeMonthlyDues',
  out_of_bounds: 'typeOutOfBounds',
};

const FILTERS: Array<{ key: 'all' | ChargeStatus; labelKey: keyof Messages['charges'] }> = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'open', labelKey: 'filterOpen' },
  { key: 'paid', labelKey: 'filterPaid' },
  { key: 'cancelled', labelKey: 'filterCancelled' },
];

export default async function MiniChargesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const status = parseChargesStatusParam(searchParams?.status);
  const rows = await listChargesFiltered(db, { userId: user.id, status, limit: 50 });

  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>{m.mini.yourCharges}</h2>

      <div className="mini-filterbar">
        {FILTERS.map((f) => {
          const href = f.key === 'all' ? '/mini/charges' : `/mini/charges?status=${f.key}`;
          const active = (status ?? 'all') === f.key;
          return (
            <Link key={f.key} href={href} data-active={active}>
              {m.charges[f.labelKey] as string}
            </Link>
          );
        })}
      </div>

      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.mini.none}</MiniEmpty>
        ) : (
          rows.map((c) => {
            const statusKey = c.status as ChargeStatus;
            const typeLabelKey = TYPE_LABEL_KEYS[c.type];
            const typeLabel = typeLabelKey ? (m.charges[typeLabelKey] as string) : c.type;
            return (
              <MiniRow
                key={c.id}
                title={c.description}
                subtitle={
                  <>
                    <span>{formatDate(c.createdAt, locale)}</span>
                    <MiniBadge variant="neutral">{typeLabel}</MiniBadge>
                  </>
                }
                right={
                  <>
                    <span>{formatCents(c.amount)}</span>
                    <MiniBadge variant={STATUS_VARIANT[statusKey] ?? 'neutral'}>
                      {m.charges[STATUS_LABEL_KEYS[statusKey]] as string ?? c.status}
                    </MiniBadge>
                  </>
                }
              />
            );
          })
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 6.6: Typecheck + test**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6.7: Commit**

```bash
git add src/app/(mini)/mini/charges/filter.ts \
        src/app/(mini)/mini/charges/page.tsx \
        tests/shared/mini-charges-filter.test.ts
git commit -m "$(cat <<'EOF'
feat(mini): charges filter + richer rows

- Status filter pills (All / Open / Paid / Cancelled) backed by ?status= and
  the existing listChargesFiltered domain function
- Each row: description, date + type chip subtitle, amount + status pill
- parseChargesStatusParam unit-tested

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Payments page rewrite

**Files:**
- Modify: `src/app/(mini)/mini/payments/page.tsx`

- [ ] **Step 7.1: Replace payments page**

```tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniEmpty } from '../../_components/mini-empty';

export default async function MiniPaymentsPage() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const rows = await listPaymentsByPayer(db, user.id);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>{m.mini.yourPayments}</h2>
      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.mini.none}</MiniEmpty>
        ) : (
          rows.map((p) => {
            const isCash = p.method === 'cash';
            const methodLabel = isCash ? m.common.methodCash : m.common.methodCard;
            const icon = isCash ? '💵' : '💳';
            return (
              <MiniRow
                key={p.id}
                title={<>{icon} {methodLabel}</>}
                subtitle={<span>{formatDate(p.receivedAt, locale)}</span>}
                right={<span>{formatCents(p.amount)}</span>}
              />
            );
          })
        )}
      </MiniSection>
      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 7.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7.3: Commit**

```bash
git add src/app/(mini)/mini/payments/page.tsx
git commit -m "$(cat <<'EOF'
feat(mini): payments rows use localized method + theme vars

Localized method label (m.common.methodCash / methodCard) with cash/card
icon, date subtitle, amount right-aligned via MiniRow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Home (Dashboard) — bigger debt card + admin pots + Recent

**Files:**
- Modify: `src/app/(mini)/mini/page.tsx`

- [ ] **Step 8.1: Replace home page**

```tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getMemberOutstandingDebt, listChargesFiltered } from '@/server/domain/charges';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from './init';
import { MiniTabs } from './tabs';
import { MiniCard } from '../_components/mini-card';
import { MiniRow } from '../_components/mini-row';
import { MiniSection } from '../_components/mini-section';
import { MiniEmpty } from '../_components/mini-empty';

interface RecentItem {
  key: string;
  iso: string;
  title: string;
  subtitle: string;
  amount: number;
  icon: string;
}

export default async function MiniDashboard() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);

  const [recentCharges, recentPayments] = await Promise.all([
    listChargesFiltered(db, { userId: user.id, limit: 5 }),
    listPaymentsByPayer(db, user.id),
  ]);

  const items: RecentItem[] = [
    ...recentCharges.map((c) => ({
      key: `c-${c.id}`,
      iso: c.createdAt,
      title: c.description,
      subtitle: formatDate(c.createdAt, locale),
      amount: c.amount,
      icon: '🧾',
    })),
    ...recentPayments.slice(0, 5).map((p) => ({
      key: `p-${p.id}`,
      iso: p.receivedAt,
      title: p.method === 'cash' ? m.common.methodCash : m.common.methodCard,
      subtitle: formatDate(p.receivedAt, locale),
      amount: p.amount,
      icon: p.method === 'cash' ? '💵' : '💳',
    })),
  ]
    .sort((a, b) => (a.iso < b.iso ? 1 : -1))
    .slice(0, 5);

  return (
    <>
      <MiniInit />

      <MiniCard variant={debt > 0 ? 'debt' : 'settled'} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.75 }}>
          {debt > 0 ? m.mini.youOwe : m.mini.settled}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{formatCents(debt)}</div>
      </MiniCard>

      {user.role === 'admin' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <MiniCard>
            <div style={{ fontSize: 11, color: 'var(--mini-hint)', textTransform: 'uppercase' }}>
              {m.dashboard.cashPot}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: 'var(--mini-text)' }}>
              {formatCents(pots.cash)}
            </div>
          </MiniCard>
          <MiniCard>
            <div style={{ fontSize: 11, color: 'var(--mini-hint)', textTransform: 'uppercase' }}>
              {m.dashboard.cardPot}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: 'var(--mini-text)' }}>
              {formatCents(pots.card)}
            </div>
          </MiniCard>
        </div>
      )}

      <MiniSection heading={m.dashboard.movementsHeading}>
        {items.length === 0 ? (
          <MiniEmpty>{m.mini.none}</MiniEmpty>
        ) : (
          items.map((it) => (
            <MiniRow
              key={it.key}
              title={<>{it.icon} {it.title}</>}
              subtitle={<span>{it.subtitle}</span>}
              right={<span>{formatCents(it.amount)}</span>}
            />
          ))
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 8.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8.3: Commit**

```bash
git add src/app/(mini)/mini/page.tsx
git commit -m "$(cat <<'EOF'
feat(mini): richer Home — debt card, admin pots, recent activity

- Debt card uses MiniCard with semantic debt/settled variants (theme-safe)
- Admin: cash/card pots as two side-by-side MiniCards
- New 'Money flow' section interleaves the user's own last charges and
  payments by date (top 5)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Info page — Markdown

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/app/(mini)/_components/markdown.tsx`
- Modify: `src/app/(mini)/mini/info/page.tsx`

- [ ] **Step 9.1: Add `react-markdown`**

Run: `pnpm add react-markdown@^9`
Expected: dep added, lockfile updated.

- [ ] **Step 9.2: Build `Markdown` client component**

Create `src/app/(mini)/_components/markdown.tsx`:

```tsx
'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

const components: Components = {
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

const ALLOWED = ['p','h1','h2','h3','h4','ul','ol','li','strong','em','code','pre','a','blockquote','hr','br'];

export function Markdown({ source }: { source: string }) {
  return (
    <div className="mini-markdown">
      <ReactMarkdown allowedElements={ALLOWED} unwrapDisallowed components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 9.3: Replace info page**

```tsx
// src/app/(mini)/mini/info/page.tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listInfoPages } from '@/server/domain/info-pages';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniEmpty } from '../../_components/mini-empty';
import { Markdown } from '../../_components/markdown';

export default async function MiniInfoPage() {
  await requireUser();
  const db = getDb();
  const pages = await listInfoPages(db);
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>{m.mini.infoTitle}</h2>
      {pages.length === 0 ? (
        <MiniEmpty>{m.mini.noEntries}</MiniEmpty>
      ) : (
        pages.map((p) => (
          <MiniSection key={p.id}>
            <h3 style={{ fontSize: 15, margin: '8px 0 4px', color: 'var(--mini-text)' }}>{p.title}</h3>
            <Markdown source={p.body} />
          </MiniSection>
        ))
      )}
      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 9.4: Typecheck + run all tests**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add package.json pnpm-lock.yaml \
        src/app/(mini)/_components/markdown.tsx \
        src/app/(mini)/mini/info/page.tsx
git commit -m "$(cat <<'EOF'
feat(mini): render Info entries as Markdown

Uses react-markdown with an explicit allow-list (paragraphs, headings,
lists, bold/italic, code, links, blockquotes, hr, br). Links open in a
new tab. Styled via .mini-markdown CSS class.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final verification

- [ ] **Step 10.1: Full typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10.2: Full test run**

Run: `pnpm vitest run`
Expected: all green, including the existing `i18n catalog parity` test.

- [ ] **Step 10.3: Production build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 10.4: Smoke run dev server**

Run: `pnpm dev` (background or another shell), open `http://localhost:3000/mini`.
- The mini app should render with no console errors.
- Outside Telegram, you'll see the "Open in Telegram" gate using theme defaults.
- Bottom tabs visible and styled.

If verifying inside Telegram, expect: theme adopts your Telegram colors, RU/EN chip in the header switches the page language, status pills appear on Charges, Info renders Markdown.

- [ ] **Step 10.5: No commit needed** — verification only.

---

## Self-review notes

- Spec sections vs tasks:
  - **Theme** → Task 1 (CSS) + Task 1 (`MiniInit`) + Task 5 (auth gate).
  - **Shared primitives** → Task 3.
  - **Locale seeding** → Task 2 (`seedLocaleIfMissing` + route).
  - **In-mini language toggle** → Task 2 (`LocaleChip` + `MiniHeader`).
  - **Home enhancements** → Task 8.
  - **Charges enhancements** → Task 6.
  - **Payments enhancements** → Task 7.
  - **Info Markdown** → Task 9.
  - **Haptics** → Task 4.
- No placeholders. Every code step shows the actual code. Every command is concrete with expected output.
- Type consistency: `MiniAppUser.language_code` defined in Task 2.5 is used in Task 2.6. `parseChargesStatusParam` defined in Task 6.3 is used in Task 6.5. `MiniCard variant` enum defined in Task 3.1 matches the values used in Task 8.1 (`'debt' | 'settled'`). `MiniBadge variant` defined in Task 3.3 matches usage in Tasks 6 and 7 (`'success' | 'warn' | 'danger' | 'neutral'`).
- Task 1 ends in a state where typecheck fails (the `MiniHeader` import in `layout.tsx` doesn't resolve yet). This is acceptable because Task 1 explicitly defers the verify-build step to Task 2 and Task 1 has no commit step. Tasks 2 onward each end at a green state.
