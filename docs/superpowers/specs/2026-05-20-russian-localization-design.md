# Bilingual EN/RU Localization

Status: draft — awaiting user review
Date: 2026-05-20 (revised — original Russian-only design superseded)

## Goal

Make the app fully bilingual (English ⇄ Russian) with per-user preference. Every user-facing string — web UI and Telegram bot — exists in both languages. Users pick their language; the app auto-detects on first contact.

Russian uses formal "вы" tone.

## High-level decisions

- **Storage**: per-user, in DB. New `locale` column on `users` table, nullable.
- **Default for new users**: auto-detect — `ctx.from.language_code` on bot side, `Accept-Language` header on web. Fallback to `ru`.
- **Switcher**: header dropdown on web (RU/EN), `/language` command on bot.
- **Approach**: custom mini-i18n (no library). Two TypeScript message catalogs with identical structure, type-checked at compile time so any missing key in either language is caught.

Rationale for no library: only 2 languages, single self-hosted app, App Router server components mean a library buys little. Custom is ~150 lines and stays out of the way.

## Surfaces in scope

1. **Web UI** in `src/app/**` — all text, including the `/login` page (no user yet, so resolution falls back to cookie / Accept-Language).
2. **Telegram bot** in `src/server/bot/**` — every `ctx.reply`, every inline keyboard label, every conversation prompt.
3. **ActionError surface messages** — translated at the catch site by code, not by string (see below).
4. **HTML `lang` attribute** — set per request from resolved locale.
5. **Page metadata** — `<title>` resolved per locale.
6. **Date formatting** — locale-aware via a `formatDateTime(d, locale)` helper.

## Surfaces out of scope

- Domain invariant `throw new Error(...)` (e.g. "payer X not found") in `src/server/domain/**` — programmer errors, never normally surfaced.
- Bot command tokens (`/start`, `/menu`, etc.) — Telegram BotAPI restricts these to `[a-z0-9_]`.
- Currency symbols — already configurable per-team via `settings.currency`.
- User-generated content (info-page bodies, display names, descriptions).

## Schema change

Add to `users` table:

```ts
locale: text('locale', { enum: ['en', 'ru'] }),  // nullable; null = auto-detect on next contact
```

Migration generated via `pnpm db:generate`. The column is nullable so existing users are unaffected; on their next login or bot interaction we auto-detect and persist.

## Module layout

```
src/shared/i18n/
  index.ts          # Locale type, LOCALES, DEFAULT_LOCALE, getMessages, detectFromAcceptLanguage, detectFromTelegram
  messages-en.ts    # English catalog — source of truth for shape
  messages-ru.ts    # Russian catalog — typed as Messages, compile error if a key is missing
  types.ts          # type Messages = typeof MESSAGES_EN (or hand-written interface)

src/shared/format.ts
  + formatDateTime(d, locale)
  + formatDate(d, locale)

src/server/i18n/
  resolve.ts        # resolveLocaleForRequest() — server-side resolution combining user.locale + cookie + Accept-Language

src/app/_i18n-provider.tsx   # client context provider; useMessages() hook
```

### Locale type and constants

```ts
// src/shared/i18n/index.ts
export type Locale = 'en' | 'ru';
export const LOCALES: readonly Locale[] = ['en', 'ru'] as const;
export const DEFAULT_LOCALE: Locale = 'ru';

import { MESSAGES_EN } from './messages-en';
import { MESSAGES_RU } from './messages-ru';

export type Messages = typeof MESSAGES_EN;

const catalogs: Record<Locale, Messages> = {
  en: MESSAGES_EN,
  ru: MESSAGES_RU as Messages,  // typed identically; TS errors if shape diverges
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

export function detectFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  // first language tag, lowercase, language-only
  const tag = header.split(',')[0]?.trim().toLowerCase().split('-')[0];
  return tag === 'ru' ? 'ru' : tag === 'en' ? 'en' : DEFAULT_LOCALE;
}

export function detectFromTelegram(languageCode: string | undefined): Locale {
  if (!languageCode) return DEFAULT_LOCALE;
  return languageCode.toLowerCase().startsWith('ru') ? 'ru' : languageCode.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}
```

### Catalog shape

Plain nested object. Static strings as string fields; parameterized strings as arrow functions:

```ts
// src/shared/i18n/messages-en.ts
export const MESSAGES_EN = {
  brand: 'Team Budget',
  nav: {
    dashboard: 'Dashboard',
    members: 'Members',
    charges: 'Charges',
    payments: 'Payments',
    spendings: 'Spendings',
    info: 'Info',
    settings: 'Settings',
    adminBadge: '(admin)',
  },
  auth: {
    loginTitle: 'Team Budget',
    loginSubtitle: 'Sign in with your Telegram account.',
  },
  dashboard: {
    cashPot: 'Cash pot',
    cardPot: 'Card pot',
    activityHeading: 'Recent activity',
    noActivity: 'Nothing yet.',
    settled: 'Settled',
    owes: (amount: string) => `Owes ${amount}`,
    youOweLabel: 'You owe',
    youSettledLabel: 'Settled',
    teamSummary: 'Team summary',
    potsLine: (cash: string, card: string) => `Cash pot ${cash} · Card pot ${card}`,
    membersHeading: (count: number) => `Members (${count})`,
    chargeLine: (amount: string, name: string, desc: string) => `🧾 Charge ${amount} → ${name}: ${desc}`,
    paymentLine: (payer: string, amount: string, method: string) => `💵 ${payer} paid ${amount} (${method})`,
    spendingLine: (amount: string, pot: string, desc: string) => `🛒 ${amount} from ${pot}: ${desc}`,
  },
  // ... full surface coverage
  bot: {
    start: {
      welcomeBack: (name: string) => `Welcome back, ${name}. /menu to see options.`,
      inviteInvalid: 'That invite is invalid or has already been used.',
      welcomeNew: (name: string) => `Welcome to the team, ${name}! /menu to see options.`,
      welcomeAdmin: 'Welcome, admin. The team budget is yours. /menu to see options.',
      notMember: 'You are not a team member yet. Ask your admin for an invite link.',
    },
    // ... menu, help, charge, pay, spend, info, invite, history, balance
    language: {
      prompt: 'Choose your language:',
      btnEnglish: '🇬🇧 English',
      btnRussian: '🇷🇺 Русский',
      switched: (loc: 'en' | 'ru') => loc === 'ru' ? 'Язык переключён на русский.' : 'Language switched to English.',
    },
  },
  errors: {
    adminOnly: 'This command is for admins only.',
    notMember: 'You are not a team member yet. Ask your admin for an invite link.',
    invalidAmount: 'Invalid amount. Aborted.',
    noMembersSelected: 'No members selected. Aborted.',
    settledMember: 'That member is settled. Aborted.',
    signInRequired: 'Sign in required.',
    adminRequired: 'Admin required.',
  },
} as const;
```

`messages-ru.ts` mirrors the structure exactly; TypeScript catches missing or extra keys because `catalogs.ru` is typed `Messages`.

### Why arrow functions for parameterized strings

It keeps the message catalog opinionated about ordering and grammar — Russian sentences often re-order arguments compared to English. A catalog like:

```ts
en: { paidLine: (payer, amount, method) => `${payer} paid ${amount} (${method})` }
ru: { paidLine: (payer, amount, method) => `${payer} внёс ${amount} (${method})` }
```

lets each language compose its own sentence from the same arguments.

## Locale resolution

### Web (server-side)

`resolveLocaleForRequest(): Promise<Locale>` order:
1. If user is authenticated and `user.locale` is set → return it.
2. Else if `tb_locale` cookie is set to a known locale → return it.
3. Else detect from `Accept-Language` request header.
4. Else `DEFAULT_LOCALE` (`ru`).

Called once per request in the root server components (`/login`, `(app)/layout.tsx`, `(mini)/layout.tsx`) and the resolved locale is:
- Set on `<html lang="...">`.
- Passed via `<I18nProvider locale={...}>` to client components.
- Passed explicitly to any server function that needs to format dates / produce localized output.

### Bot

`resolveBotLocale(ctx): Locale` order:
1. If `ctx.currentUser?.locale` is set → return it.
2. Else detect from `ctx.from?.language_code`.
3. Else `DEFAULT_LOCALE`.

Each handler / conversation calls this at the top and uses `getMessages(locale)`.

On first contact (e.g. `/start`), after the user is created the detected locale is persisted to `users.locale` so subsequent interactions are stable.

## Language switcher

### Web

Add a small dropdown on the right side of `AppHeader` — RU / EN. On change, calls a new server action `setMyLocale({ locale })` that:
1. Updates `users.locale` for the current user.
2. Sets `tb_locale` cookie (so pre-login pages on the same browser remember).
3. Returns; client triggers `router.refresh()`.

The mini app has no header. A small selector in `/mini` settings tab (or a tiny chip in the corner) — see [src/app/(mini)/mini/](src/app/(mini)/mini/) layout for placement; deferred to "nice to have" — bot `/language` is the primary path for mini users.

### Bot

Add `/language` command in [src/server/bot/handlers/](src/server/bot/handlers/). Sends an inline keyboard with two buttons (🇬🇧 English / 🇷🇺 Русский). Callback updates `users.locale` and replies with confirmation in the newly selected locale.

Command description registered via `setMyCommands` on bot init — also a new addition; gives users autocomplete for `/menu`, `/help`, `/language`, etc. Worth doing now since we're touching this surface.

## Server action errors

`ActionError` already carries a `code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'BAD_INPUT' | 'INTERNAL'`. Change the philosophy:
- `error.message` stays English (for logs / dev).
- UI catch sites translate by code using `messages.errors`.
- Where an action throws `BAD_INPUT` with a meaningful message, that message is treated as a translation key (or accepts an English fallback that the UI displays as-is). For this pass, the small number of BAD_INPUT throws keep English messages — most BAD_INPUT is caught by Zod schemas before reaching the action body.

## Date formatting

```ts
// src/shared/format.ts
export function formatDateTime(d: string | Date, locale: Locale): string {
  return new Date(d).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
}
export function formatDate(d: string | Date, locale: Locale): string {
  return new Date(d).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US');
}
```

Replace every `new Date(x).toLocaleString()` in `src/app/**` with `formatDateTime(x, locale)`.

## Component contracts

- **Server components**: pull locale from `resolveLocaleForRequest()`, pass to children, render via `getMessages(locale)`.
- **Client components**: `useMessages()` hook reads from `I18nProvider` context; no direct catalog imports.
- **Bot handlers**: call `resolveBotLocale(ctx)` at the top of each handler/middleware, pass `getMessages(locale)` to conversation steps.

## Files affected

New:
- `src/shared/i18n/index.ts`
- `src/shared/i18n/messages-en.ts`
- `src/shared/i18n/messages-ru.ts`
- `src/server/i18n/resolve.ts`
- `src/app/_i18n-provider.tsx`
- `src/server/bot/handlers/language.ts`
- `src/server/actions/i18n-server.ts` (the `setMyLocale` action)
- `drizzle/<n>_add_users_locale.sql` (generated)

Modified:
- `src/server/db/schema.ts` — add `locale` to users.
- `src/server/bot/middleware.ts` — translate "admins only" / "not a member" via resolved locale.
- `src/server/bot/index.ts` — register `/language` handler, `setMyCommands` with descriptions per locale.
- `src/server/bot/handlers/start.ts` — persist detected locale on user create.
- `src/server/actions/_wrapper.ts` — keep English error messages; UI translates by code.
- `src/app/layout.tsx` — dynamic `lang`, title, wrap with I18nProvider.
- `src/app/login/page.tsx` — translate copy.
- `src/app/(app)/layout.tsx` — resolve locale, pass to header & provider.
- `src/app/(app)/header.tsx` — translated nav + new language switcher.
- All other `src/app/(app)/**.tsx` and `src/app/(mini)/**.tsx` user-facing files — replace literals with `messages.*` lookups.
- All `src/server/bot/handlers/**` and `src/server/bot/conversations/**` — translated.
- `src/shared/format.ts` — locale-aware helpers.

## Execution order

1. Schema: add `locale` to `users`, generate migration, apply.
2. Add `src/shared/i18n/**` with full EN catalog. RU catalog as stub (every key present, values set to English placeholders) — so TypeScript compiles and we can incrementally fill RU.
3. Add `src/server/i18n/resolve.ts`.
4. Add `I18nProvider` + `useMessages` hook in `src/app/_i18n-provider.tsx`.
5. Convert `src/app/layout.tsx` (dynamic `lang`, provider wrap).
6. Convert `/login` (uses Accept-Language since no user).
7. Convert `(app)/layout.tsx`, `(app)/header.tsx` + language switcher dropdown + `setMyLocale` action.
8. Convert each `(app)/**` page surface.
9. Convert `(mini)/**` surfaces.
10. Schema-touch handlers: `bot/middleware.ts`, `bot/handlers/start.ts` (persist detected locale).
11. Add `bot/handlers/language.ts` + register in `bot/index.ts` (plus `setMyCommands`).
12. Convert each `bot/handlers/**` and `bot/conversations/**` to read locale from `ctx.currentUser` / detect.
13. Fill in real Russian translations across `messages-ru.ts` (formal "вы").
14. Update date formatting calls in `src/app/**` to use `formatDateTime(x, locale)`.
15. `pnpm typecheck`. `pnpm build`. Fix any issue.
16. Smoke: switch language on web, switch via `/language` in bot, verify nav + dashboard + bot replies render in chosen language for both.

## Tests

- Vitest unit tests (domain logic) — unaffected.
- Playwright e2e tests — any assertion on translated text becomes a lookup into the same catalog, or assertions are pinned to a fixed locale by setting the cookie at test setup. Updated as encountered during execution.
- Add a single TS-level sanity test (Vitest) that imports both catalogs and asserts deep-key parity — guards against future drift. Lightweight, ~10 lines.

## Risks

- **Russian translation quality**: I'm producing first-pass Russian. User reviews and edits in `messages-ru.ts` before declaring done.
- **Migration runs in prod**: Per memory, migrations are applied manually via piped SQL on TrueNAS. The generated `ALTER TABLE users ADD COLUMN locale ...` is a non-destructive additive change; safe.
- **Cookie + cross-domain**: not relevant — single-origin self-hosted app behind Cloudflare Tunnel.
- **Mini app rendering**: must not break — mini layout already resolves user, so locale resolution lives in the same place.
- **Bot conversations holding state**: grammY conversations re-enter on every message. The locale must be re-resolved each step (or captured into conversation state at start). Re-resolving each step is simpler; the trip to DB for `currentUser` already happens via middleware. We use `ctx.currentUser?.locale` inside each step.

## What done looks like

- Logging in fresh from an `Accept-Language: ru` browser lands on `/dashboard` in Russian.
- Header dropdown switches to English; page reloads in English; choice survives logout/login.
- `/start` against the bot from a Russian Telegram client returns Russian greeting; `/start` from English client returns English.
- `/language` on the bot shows a 2-button keyboard; tapping flips the user's preference; subsequent replies are in the new language.
- `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass.
- No remaining English literal in user-facing surfaces under either locale (verified by grep over the converted files).
