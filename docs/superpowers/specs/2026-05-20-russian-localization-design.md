# Russian Localization (Russian-only)

Status: draft — awaiting user review
Date: 2026-05-20

## Goal

Convert every user-facing string in the app to Russian, formal "вы" tone. The app is single-language afterward — no language switcher, no locale negotiation, no fallback to English.

## Surfaces in scope

1. **Web UI** in `src/app/**` — pages, headers, forms, dashboards, mini app. ~30 `.tsx` files contain user-visible literals.
2. **Telegram bot** in `src/server/bot/**` — every `ctx.reply(...)`, every `await ctx.reply(...)` argument, every prompt inside grammY conversations, every inline keyboard button label, every "no items" empty-state message. 16 files.
3. **Server action errors** that surface to the user — `ActionError` messages in `src/server/actions/_wrapper.ts` (`'sign in required'`, `'admin required'`) and any other thrown `ActionError` raised from action wrappers.
4. **HTML language attribute** — `<html lang="en">` → `<html lang="ru">` in `src/app/layout.tsx`.
5. **Page metadata** — `metadata = { title: 'Team Budget' }` in `src/app/layout.tsx`.
6. **Date formatting** — every `.toLocaleString()` / `.toLocaleDateString()` in `src/app/**` switches to a shared `formatDateTime` / `formatDate` helper that pins locale to `'ru-RU'`.

## Surfaces out of scope (remain English)

- `throw new Error(...)` messages in `src/server/domain/**` — these are invariant violations / programmer errors that never reach end users in normal flow.
- Bot command tokens (`/start`, `/menu`, `/help`, `/balance`, `/history`, `/info`, `/invite`) — these are commands, not display strings. (Help text *describing* them is in scope.)
- Currency symbol formatting — already configurable per-team via `settings.currency`.
- User-generated content — info-page titles/bodies, member display names, charge descriptions.
- Existing test fixtures and assertions — adjusted only if they assert on now-translated strings (see "Tests" below).

## Approach: centralized `STR` table

Add a single new module `src/shared/strings.ts` that exports a `STR` constant — an object literal grouped by surface. Replace inline string literals throughout the codebase with references into `STR`.

Why centralized rather than replace-in-place:

- Tone consistency (formal "вы") is reviewable in one file rather than scattered across ~50 files.
- Typos and unintentional English remnants are greppable: any non-Cyrillic literal under `src/app/**` or `src/server/bot/**` after this change is a smell.
- Future retoning (e.g. switching to informal "ты") is a single-file edit.
- Adds zero runtime dependencies — `STR` is a plain TypeScript object, tree-shakeable.

### Shape of `STR`

```ts
export const STR = {
  brand: 'Командный бюджет',

  nav: {
    dashboard: 'Главная',
    members: 'Участники',
    charges: 'Начисления',
    payments: 'Платежи',
    spendings: 'Траты',
    info: 'Информация',
    settings: 'Настройки',
    adminBadge: '(админ)',
  },

  auth: {
    loginTitle: 'Командный бюджет',
    loginSubtitle: 'Войдите через свой Telegram-аккаунт.',
    signInRequired: 'Требуется вход в систему.',
    adminRequired: 'Требуются права администратора.',
  },

  dashboard: {
    cashPot: 'Касса (наличные)',
    cardPot: 'Касса (карта)',
    activityHeading: 'Последние события',
    noActivity: 'Событий пока нет.',
    settled: 'Долгов нет',
    owes: (amount: string) => `Долг: ${amount}`,
    // ...
  },

  bot: {
    start: {
      welcomeBack: (name: string) =>
        `С возвращением, ${name}. Команда /menu — список действий.`,
      inviteInvalid: 'Эта ссылка-приглашение недействительна или уже использована.',
      welcomeNew: (name: string) =>
        `Добро пожаловать в команду, ${name}! Команда /menu — список действий.`,
      welcomeAdmin:
        'Здравствуйте, администратор. Бюджет команды теперь под вашим управлением. /menu — список действий.',
      notMember: 'Вы пока не участник команды. Попросите администратора прислать ссылку-приглашение.',
    },
    charge: {
      typePrompt: 'Тип начисления?',
      memberPrompt: 'Участник?',
      // ...
    },
    // ... pay, spend, info, invite, help, history, balance, menu
  },

  errors: {
    invalidAmount: 'Некорректная сумма. Действие отменено.',
    noMembersSelected: 'Участники не выбраны. Действие отменено.',
    settledMember: 'У этого участника нет долгов. Действие отменено.',
    adminOnly: 'Эта команда только для администраторов.',
  },
} as const;
```

The grouping is by **surface** (route / handler), not by **semantic category**. The reason: a translator (or future me) scrolling `strings.ts` should be able to find a string by remembering where it appears, without needing to know an ontology.

Where a string is parameterized (display name, amount, count), the value is a function. Where it's static, it's a string literal. No template-string interpolation in `STR` itself.

### Date / time helpers

Add to `src/shared/format.ts`:

```ts
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('ru-RU');
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}
```

Replace every `new Date(x).toLocaleString()` and `.toLocaleDateString()` in `src/app/**` with these helpers. (`src/server/**` does not use locale-formatted dates for display — only for ISO storage — so it's untouched.)

## Files affected

Web (estimated by `find src/app -name '*.tsx'`):

- `src/app/layout.tsx` — `lang`, `metadata.title`
- `src/app/login/page.tsx`
- `src/app/(app)/header.tsx`
- `src/app/(app)/dashboard/page.tsx`, `dashboard/activity.tsx`, `dashboard/pot-card.tsx`, `dashboard/member-row.tsx`
- `src/app/(app)/members/page.tsx`, `members/invite-button.tsx`, `members/[id]/page.tsx`, `members/[id]/admin-controls.tsx`
- `src/app/(app)/charges/page.tsx`, `charges/charge-row.tsx`, `charges/cancel-button.tsx`
- `src/app/(app)/charges/new/page.tsx`, `new-charge-tabs.tsx`, `adhoc-form.tsx`, `pot-borrow-form.tsx`, `split-form.tsx`
- `src/app/(app)/payments/page.tsx`, `payments/cancel-button.tsx`, `payments/new/page.tsx`
- `src/app/(app)/spendings/page.tsx`, `spendings/cancel-button.tsx`, `spendings/new/page.tsx`
- `src/app/(app)/info/page.tsx`, `info/page-editor.tsx`
- `src/app/(app)/settings/page.tsx`, `settings/dues-form.tsx`, `settings/categories-list.tsx`
- `src/app/(mini)/layout.tsx`, `(mini)/mini/page.tsx`, `mini/init.tsx`, `mini/tabs.tsx`, `mini/auth-gate.tsx`
- `src/app/(mini)/mini/charges/page.tsx`, `mini/payments/page.tsx`, `mini/info/*`

Bot:

- `src/server/bot/handlers/start.ts`, `menu.ts`, `help.ts`, `balance.ts`, `history.ts`, `info.ts`, `invite.ts`
- `src/server/bot/conversations/charge.ts`, `pay.ts`, `spend.ts`, `info-edit.ts`
- `src/server/bot/notifications.ts`

Other:

- `src/shared/strings.ts` — new
- `src/shared/format.ts` — add `formatDateTime`, `formatDate`
- `src/server/actions/_wrapper.ts` — Russian `ActionError` messages

## Execution order

1. Create `src/shared/strings.ts` with the full `STR` table (drafted top-to-bottom in one pass so tone is consistent).
2. Add `formatDateTime` / `formatDate` to `src/shared/format.ts`.
3. Convert `src/app/layout.tsx` (`lang`, title) and `src/app/login/page.tsx`.
4. Convert `src/app/(app)/**` — header first, then dashboard, then per-feature routes.
5. Convert `src/app/(mini)/**`.
6. Convert `src/server/bot/handlers/**`.
7. Convert `src/server/bot/conversations/**` and `notifications.ts`.
8. Convert `ActionError` messages in `src/server/actions/_wrapper.ts`.
9. `pnpm typecheck` — must pass.
10. `pnpm build` — must pass.
11. Smoke grep: `grep -rEn "[A-Z][a-z]{2,}" src/app src/server/bot --include='*.ts' --include='*.tsx' | grep -v "import\|from '@/\|className\|^[^:]*:[0-9]*: *//"` — review residual English-looking literals; some will be brand tokens, identifiers, route names, or `as const` keys — anything that's user-visible needs to be translated.
12. Manual smoke: open `/login`, `/dashboard`, `/mini` in a browser; run `/start`, `/menu`, `/help`, `/balance`, `/history` against the bot.

## Tests

Two test layers exist:

- **Vitest** unit tests in `tests/` — these test domain logic, not UI strings. Should be unaffected.
- **Playwright** e2e in `tests/` (per `playwright.config.ts`) — may assert on user-visible text. Each e2e file is grepped during execution; any English assertion on translated text is updated to its Russian counterpart from `STR`.

No new test scaffolding is added. The smoke checks in step 11–12 of execution are sufficient verification for a copy-only change.

## Risks / non-issues

- **Stringly-typed risk**: `STR.bot.charge.typePrompt` is a static field reference; renaming requires a grep. Acceptable for the scale of this app.
- **Format functions in `STR`**: a function-shaped entry like `welcomeBack(name)` is technically not a string. It's still fine to live in `STR` because the consumer pattern is identical (`STR.bot.start.welcomeBack(name)`). Alternative — separate `STR_FN` module — adds ceremony for no payoff.
- **Brand name "Team Budget"**: translated to "Командный бюджет" everywhere, per user instruction "all user-facing texts in Russian". If the user wants the brand kept English, this is a 1-line revert in `STR.brand` and `STR.auth.loginTitle`.
- **Bot command names** (`/start`, `/menu`, ...) stay English because they are interface tokens registered with Telegram, not display strings. Help text *describing* them is translated.
- **`lang="ru"` and CSS**: BaseUI / styletron have no locale-dependent behavior here. No layout impact expected.

## What done looks like

- Opening `/login` in a fresh browser shows Russian copy with formal "вы" tone.
- Every page under `/dashboard`, `/members`, `/charges`, `/payments`, `/spendings`, `/info`, `/settings` shows Russian copy. Currency formatting still respects per-team `settings.currency`.
- The mini app under `/mini` shows Russian copy.
- Running `/start`, `/menu`, `/help`, `/balance`, `/history`, `/info`, `/invite` against the Telegram bot returns Russian replies in formal "вы" tone.
- Inline keyboards (e.g. "Done" button in member-pick) show Russian labels.
- Action errors ("sign in required" → "Требуется вход в систему") render in Russian when triggered.
- Dates in lists render in `ru-RU` format (e.g. `20.05.2026, 14:30:00`).
- `pnpm typecheck` and `pnpm build` pass.
- No new dependencies added to `package.json`.
