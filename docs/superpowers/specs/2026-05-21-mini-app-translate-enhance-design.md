# Mini App — Translate & Enhance

## Problem

The Telegram Mini App at `/mini` works but feels like a placeholder:

- Visual: inline styles, hard-forced white background, ignores `Telegram.WebApp.themeParams` even though it captures them into CSS variables. No haptic feedback. No shared primitives — each tab re-implements its own row/card.
- Translation gaps: Payment rows render `p.method` raw (e.g. `"cash"`) instead of the localized `m.common.methodCash`. Charges rows don't show the date or type. Locale is never seeded from `Telegram.WebApp.initDataUnsafe.user.language_code` — a new member's first sign-in falls back to `DEFAULT_LOCALE` regardless of their phone language. The mini app has no in-app language toggle (users must go back to the bot and type `/language`).
- Content: Info entries are rendered as `<pre>` blocks — admins author Markdown in `/info_edit` but mini app readers see literal asterisks and underscores.
- Home is sparse: a single debt card and a one-line cash/card summary for admins. Members get no sense of recent activity without opening Charges or Payments.

## Goal

Make the Mini App feel Telegram-native, fully localized end-to-end, and useful at a glance, without expanding scope beyond what's already in the data model.

## Scope

**In scope:**

1. **Theme**: drop the forced white background; apply `Telegram.WebApp.themeParams` to CSS variables on `:root`; mini-app components consume those vars (with safe light defaults). `colorScheme` exposed as a `data-` attribute.
2. **Shared primitives** under `src/app/(mini)/_components/`: `MiniHeader`, `MiniCard`, `MiniRow`, `MiniBadge`, `MiniSection`, `MiniEmpty`, `LocaleChip`.
3. **Locale seeding**: when a new user signs into the mini app and has no saved `locale`, seed it from the Telegram `user.language_code` field (already part of `initData.user`) using existing `detectFromTelegram` + `updateUserLocale`. Also set the `tb_locale` cookie so the same response renders in the right language.
4. **In-mini language toggle**: a small `RU | EN` chip in the header that calls the existing `setMyLocale` server action, then reloads.
5. **Home enhancements**:
   - Bigger, theme-aware debt card (tinted red/green by debt state, not hard hex).
   - Admin view: cash and card pots as two side-by-side `MiniCard`s instead of one line.
   - "Recent" section: the user's own last 5 charges and payments interleaved by date desc.
6. **Charges enhancements**:
   - Status filter buttons (All / Open / Paid / Cancelled) backed by `?status=` query param and existing `listChargesFiltered`.
   - Each row: description + date (hint color), amount + localized status pill, localized type chip.
7. **Payments enhancements**:
   - Method as icon + localized label (`m.common.methodCash` / `methodCard`).
   - Date already shown, restyled.
8. **Info enhancements**: render `p.body` as Markdown using `react-markdown` (added as a dep). Headings, lists, bold/italic, inline code, links.
9. **Haptics**: light impact (`tg.HapticFeedback.impactOccurred('light')`) on tab change.

**Out of scope:**

- Spendings tab (admin domain; the admin dashboard already covers it).
- Money-flow grid in the mini app (too dense for phone width).
- Telegram `BackButton` / `MainButton` wiring (low value vs. tabs; can be added later).
- Charts / graphs.
- A separate dark-mode stylesheet (we just consume `themeParams`).
- Server-side rendering of Markdown to HTML (client-side `react-markdown` is fine; the trees are tiny).
- Telegram cloud storage / settings persistence.

## User-visible behavior

### First-time sign-in

1. User taps the Mini App button in the bot. Telegram opens the WebView and sends `initData` with `user.language_code = "ru"`.
2. `/api/auth/telegram/mini` verifies the data and finds an existing team member with `locale = null` (or bootstraps the admin).
3. The route writes `locale = "ru"` to the user row and sets the `tb_locale` cookie to `ru`.
4. The post-reload server render uses Russian throughout.

If the user already has a saved `locale`, it is **not** overwritten. The Telegram language is only used as the initial seed.

### Header

A 36 px row above the tab content shows the team brand (`m.brand`) on the left and a `RU | EN` chip on the right. The active locale is highlighted (theme `button_color` background, `button_text_color` text); the inactive one is hint-colored. Tapping the inactive locale fires `setMyLocale` and reloads the page.

### Home tab

- **Debt card** — large `MiniCard`, variant `debt` or `settled`. `m.mini.youOwe` / `m.mini.settled` as caption, current outstanding amount as the headline. The variant uses semantic palette tokens (`--mini-danger-bg`, `--mini-danger-fg` / `--mini-success-bg`, `--mini-success-fg`) defined in `mini.css` with light defaults and a `[data-tg-scheme="dark"]` override block so the pills/cards stay legible on dark themes. Semantic colors are not derived from `themeParams` — meaning ("you owe / settled") must read the same regardless of the user's Telegram theme.
- **Admin pots** — for admins, two side-by-side `MiniCard`s: cash and card balances, captions from `m.dashboard.cashPot` / `m.dashboard.cardPot`.
- **Recent** — `MiniSection` titled `m.dashboard.movementsHeading`. Up to 5 rows, interleaved from the user's own charges (`listChargesFiltered({ userId, limit: 5 })`) and payments (`listPaymentsByPayer(userId, 5)`), sorted by date descending. Each row uses `MiniRow`: icon (🧾 for charge, 💵/💳 for payment), short description (charge description or `m.common.methodCash`/`methodCard`), date, amount. Empty state via `MiniEmpty`.

### Charges tab

- **Filter row** at the top: four pill-shaped buttons (`All` / `Open` / `Paid` / `Cancelled`) using `m.charges.filterAll/filterOpen/filterPaid/filterCancelled`. The active filter is highlighted. Clicking a filter navigates to `/mini/charges?status=open` (etc.). `All` clears the query.
- Each charge row: description on top line, date + type chip on the second line (small, hint color), amount + status pill on the right. Status pill colors: open = warning (amber), paid = success (green), cancelled = neutral. Localized labels from `m.charges.statusOpen/statusPaid/statusCancelled` and `m.charges.typeAdhoc/...`.
- Empty state via `MiniEmpty` using `m.mini.none`.

### Payments tab

- Each payment row: icon (💵/💳) + localized method label + date on the left; amount on the right. Uses `MiniRow`.
- Empty state via `MiniEmpty`.

### Info tab

- Each entry renders with the title as `<h3>` and the body via `react-markdown`. Standard nodes: paragraphs, headings up to `<h4>`, unordered + ordered lists, bold, italic, inline code, fenced code, links (open in new tab). No raw HTML.
- Empty state via `MiniEmpty`.

### Theming

`MiniInit` reads `Telegram.WebApp.themeParams` and writes them to `:root` as CSS variables:

| theme param           | CSS var                 | default (light)  |
|-----------------------|-------------------------|------------------|
| `bg_color`            | `--mini-bg`             | `#ffffff`        |
| `text_color`          | `--mini-text`           | `#111827`        |
| `hint_color`          | `--mini-hint`           | `#6b7280`        |
| `link_color`          | `--mini-link`           | `#2563eb`        |
| `button_color`        | `--mini-button`         | `#16a34a`        |
| `button_text_color`   | `--mini-button-text`    | `#ffffff`        |
| `secondary_bg_color`  | `--mini-section-bg`     | `#f9fafb`        |

All mini-app primitives use these vars only — no inline hex except for status-pill semantic colors (success/warn/danger/neutral), which keep their explicit palette because the meaning must read the same in any theme. `MiniInit` also sets `<body data-tg-scheme="light|dark">` for any conditional styling.

### Haptics

On tab tap in `MiniTabs`, after `Link` navigation begins, fire `Telegram.WebApp.HapticFeedback?.impactOccurred('light')` (best-effort, ignored if absent).

## Architecture

### File layout

```
src/app/(mini)/
  layout.tsx                 # unchanged shell, adds MiniHeader
  _components/
    mini-header.tsx          # server: brand + LocaleChip
    locale-chip.tsx          # client: setMyLocale + reload
    mini-card.tsx            # presentational, themed
    mini-row.tsx
    mini-badge.tsx           # variants: success | warn | danger | neutral
    mini-section.tsx
    mini-empty.tsx
  mini/
    init.tsx                 # extended: writes CSS vars to :root + haptics helper
    tabs.tsx                 # extended: haptic on click
    auth-gate.tsx            # restyled with theme vars
    page.tsx                 # Home: debt card + admin pots + Recent
    charges/page.tsx         # filters + new row layout
    payments/page.tsx        # localized method + new row layout
    info/page.tsx            # Markdown via react-markdown
```

### Locale seeding

`MiniAppUser` (in `src/server/auth/telegram.ts`) gains an optional `language_code?: string`. `verifyMiniAppInitData` already JSON-parses the entire `user` blob, so the extra field flows through automatically.

`/api/auth/telegram/mini/route.ts` adds, right after the user is resolved:

```ts
if (user && !user.locale && verify.user.language_code) {
  const seeded = detectFromTelegram(verify.user.language_code);
  await updateUserLocale(db, user.id, seeded);
  user = { ...user, locale: seeded };
}
```

And on the response, when the user was just created or seeded, also set the `tb_locale` cookie so the immediately-following client reload picks up the right server-rendered locale:

```ts
res.cookies.set('tb_locale', user.locale ?? DEFAULT_LOCALE, {
  httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
});
```

### In-mini language switching

`LocaleChip` is a tiny client component that imports the existing `setMyLocale` server action:

```tsx
'use client';
import { setMyLocale } from '@/server/actions/i18n-server';

export function LocaleChip() {
  const locale = useLocale();
  const flip = (next: Locale) => async () => {
    if (next === locale) return;
    await setMyLocale({ locale: next });
    window.location.reload();
  };
  return (
    <div className="mini-locale-chip">
      <button onClick={flip('ru')} data-active={locale === 'ru'}>RU</button>
      <button onClick={flip('en')} data-active={locale === 'en'}>EN</button>
    </div>
  );
}
```

`setMyLocale` already writes both the DB row and the cookie. After reload, server components re-render in the new language.

### Recent activity on Home

A new helper in `src/server/domain/movements.ts` (or a small inline merge in the page) interleaves charges + payments for a single user. Reusing existing `listChargesFiltered({ userId, limit: 5 })` and `listPaymentsByPayer(userId, 5)` and merging in memory is sufficient — both lists are already capped at 5 and the page is server-rendered. No new endpoint.

### Markdown rendering

Add `react-markdown` (peer-free, ~30 KB gzipped, escapes HTML by default). Render in a client component because `react-markdown` is a React component; the surrounding info page stays a server component and passes `body` as a prop.

```tsx
// _components/markdown.tsx
'use client';
import ReactMarkdown from 'react-markdown';

export function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      allowedElements={['p','h1','h2','h3','h4','ul','ol','li','strong','em','code','pre','a','blockquote','hr','br']}
      unwrapDisallowed
      components={{ a: (p) => <a {...p} target="_blank" rel="noopener noreferrer" /> }}
    >
      {source}
    </ReactMarkdown>
  );
}
```

### Theme application

`MiniInit` change:

```ts
const root = document.documentElement;
const map: Record<string, string> = {
  bg_color: '--mini-bg',
  text_color: '--mini-text',
  hint_color: '--mini-hint',
  link_color: '--mini-link',
  button_color: '--mini-button',
  button_text_color: '--mini-button-text',
  secondary_bg_color: '--mini-section-bg',
};
for (const [k, v] of Object.entries(tg.themeParams)) {
  const cssVar = map[k];
  if (cssVar) root.style.setProperty(cssVar, v);
}
document.body.dataset.tgScheme = tg.colorScheme;
```

Defaults live in a `_components/mini.css` imported by the `(mini)` layout. The forced `body.style.background = '#ffffff'` line is removed.

## Data flow

Server components in `(mini)/mini/**` fetch via existing domain functions, parameterized by the resolved locale and (for charges) the `status` query param. The auth gate / locale chip are the only client mutations and they reload the page on success.

```
Telegram WebApp
  ├── initData (incl. user.language_code) ─► POST /api/auth/telegram/mini
  │       └── seed user.locale + tb_locale cookie ─► reload
  └── themeParams ─► MiniInit ─► :root CSS vars

server render of /mini/* ─► resolveLocaleForRequest ─► getMessages(locale)
                       └── domain fns (charges/payments/pots/info)
```

## Error handling

- If `language_code` is missing or unknown, seeding is skipped — user gets `DEFAULT_LOCALE` (current behavior).
- If `setMyLocale` fails, the chip stays in its current state and the page is not reloaded; the user can retry.
- `react-markdown` swallows parse errors and renders best-effort; if `body` is empty we render nothing (no crash).
- `Telegram.WebApp` missing → existing `MiniAuthGate` flow already handles it; haptic and theme paths short-circuit on `!tg`.

## Testing

Project conventions: Vitest for unit, Playwright for e2e (existing `tests/e2e` covers the bot/dashboard, not the mini app).

**Unit (new):**
- `detectFromTelegram` already covered by `messages-en/ru` shape; add a direct test if missing.
- Charge filter URL → `status` mapping helper in `charges/page.tsx`.

**Integration:**
- Extend the mini auth route test (or add one) covering: existing user with `locale = null` and `language_code = "ru"` → DB write + cookie. Existing user with locale already set → no overwrite.

**Manual:**
- Open `/mini` inside Telegram on a phone with Russian and on a phone with English; confirm seeding.
- Toggle locale via chip; confirm the page re-renders in the other language and persists across reload.
- Verify cash/card pots show for admins only.
- Verify Markdown renders an Info entry that uses `# heading`, `**bold**`, `_italic_`, lists, and a link.

## Sub-projects and build order

1. **Theme + primitives** — `MiniInit` writes CSS vars; add `mini.css` defaults; build `MiniCard`, `MiniRow`, `MiniBadge`, `MiniSection`, `MiniEmpty`, `MiniHeader`. Remove forced white. Switch existing pages to primitives without changing layout/content yet. Adds shared visual baseline; no behavior change.
2. **Locale seeding + language chip** — extend `MiniAppUser`, update mini auth route, add `LocaleChip`, wire into `MiniHeader`.
3. **Page enhancements** — Home (debt + admin pots + Recent), Charges (filters + date + type chip + status pill), Payments (localized method).
4. **Markdown for Info** — add `react-markdown`, create `Markdown` client component, swap `<pre>` for `<Markdown>`.
5. **Haptics** — light impact in `MiniTabs`.

Each step is independently shippable. Steps 3–5 depend on step 1; step 2 is independent.
