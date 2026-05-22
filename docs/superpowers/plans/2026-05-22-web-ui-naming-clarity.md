# Web UI Naming Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the three confusable money-flow pages (Charges / Payments / Spendings) to clearer money-direction labels in both EN and RU, and add a one-line subtitle under each page heading explaining its role.

**Architecture:** Pure UI/i18n change. Extend the existing `PageHeader` component with an optional `subtitle` prop. Update the two i18n catalog files (`messages-en.ts`, `messages-ru.ts`) in lockstep so the `i18n-catalog-parity` test stays green. Wire the new subtitle keys on three page components. No URL, schema, or domain changes.

**Tech Stack:** Next.js App Router · TypeScript · Base Web (Baseui) · Styletron · Vitest · Playwright.

**Spec:** [docs/superpowers/specs/2026-05-22-web-ui-naming-clarity-design.md](../specs/2026-05-22-web-ui-naming-clarity-design.md)

---

## Testing Notes

- This codebase uses Vitest for domain/action logic only; there is no React Testing Library setup. UI component changes are verified by typecheck + the i18n parity test + a manual visual check against the running dev server.
- `tests/shared/i18n-catalog-parity.test.ts` enforces that EN and RU have identical key sets and shapes — this is the safety net for the new `subtitle` keys.
- `tsc --noEmit` enforces type parity across the two catalogs because `messages-ru.ts` is typed as `Messages = typeof MESSAGES_EN`.
- Existing e2e (`tests/e2e/auth.spec.ts`) only checks login redirect; no rename impact.

---

## Task 1: Extend PageHeader with optional subtitle prop

**Files:**
- Modify: `src/ui/page-header.tsx`

- [ ] **Step 1: Update PageHeader to accept and render a subtitle**

Replace the entire file contents of `src/ui/page-header.tsx` with:

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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.sizing.scale600,
      })}
    >
      <div className={css({ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 })}>
        <HeadingMedium marginTop="0" marginBottom="0">{title}</HeadingMedium>
        {subtitle ? (
          <LabelSmall color={theme.colors.contentSecondary}>{subtitle}</LabelSmall>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
```

Notes for the engineer:
- `LabelSmall` is Base Web's small body-text variant (≈13px).
- `theme.colors.contentSecondary` is Base Web's muted-text token; matches the rest of the app.
- The flex column wraps title + subtitle so the actions slot stays vertically centered against the heading, not the whole stack.

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS (no type errors). The new `subtitle?: string` prop is optional, so all existing callers continue to compile.

- [ ] **Step 3: Commit**

```bash
git add src/ui/page-header.tsx
git commit -m "feat(ui): add optional subtitle to PageHeader"
```

---

## Task 2: Update i18n catalogs (EN + RU in lockstep)

**Files:**
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`

Both files must change together — the `i18n-catalog-parity` test fails if either catalog has keys the other doesn't, and `tsc` fails if `messages-ru.ts` is out of shape with `MESSAGES_EN`.

- [ ] **Step 1: Apply renames and add subtitle keys to `messages-en.ts`**

Make exactly the following edits in `src/shared/i18n/messages-en.ts`:

**Nav block:**
```diff
   nav: {
     dashboard: 'Dashboard',
     members: 'Members',
-    charges: 'Charges',
-    payments: 'Payments',
+    charges: 'Debts',
+    payments: 'Payments in',
     guests: 'Guests',
-    spendings: 'Spendings',
+    spendings: 'Expenses',
     info: 'Info',
     settings: 'Settings',
     adminBadge: '(admin)',
   },
```

**Members block:**
```diff
-    openCharges: 'Open charges',
+    openCharges: 'Open debts',
```

**Charges block — title, subtitle, action labels:**
```diff
   charges: {
-    title: 'Charges',
-    newCharge: 'New charge',
+    title: 'Debts',
+    subtitle: 'What members owe the team',
+    newCharge: '+ New debt',
     filterAll: 'All',
     filterOpen: 'Open',
     filterPaid: 'Paid',
     filterCancelled: 'Cancelled',
-    none: 'No charges.',
+    none: 'No debts.',
```

```diff
-    newPageTitle: 'New charge',
+    newPageTitle: 'New debt',
```

```diff
-    submitAdhoc: 'Create charge',
+    submitAdhoc: 'Create debt',
     submitPotBorrow: 'Record pot borrow',
-    submitSplit: 'Create split charge',
+    submitSplit: 'Create split debt',
```

**Payments block — title + subtitle (verbs and submit labels stay):**
```diff
   payments: {
-    title: 'Payments',
+    title: 'Payments in',
+    subtitle: 'Money members paid back to the team',
     record: 'Record payment',
     none: 'No payments.',
```

**Spendings block — title, subtitle, verbs:**
```diff
   spendings: {
-    title: 'Spendings',
-    record: 'Record spending',
-    none: 'No spendings.',
+    title: 'Expenses',
+    subtitle: 'Money the team spent from its pots',
+    record: 'Record expense',
+    none: 'No expenses.',
     colPot: 'Pot',
     colDescription: 'Description',
     colCategory: 'Category',
     colAmount: 'Amount',
     colWhen: 'When',
-    newPageTitle: 'Record spending',
+    newPageTitle: 'Record expense',
     potLabel: 'Pot',
     amountLabel: 'Amount',
     descriptionLabel: 'Description',
     categoryLabel: 'Category (optional)',
     categoryPlaceholder: 'None',
-    submit: 'Record spending',
+    submit: 'Record expense',
   },
```

**Note for the engineer:** Do **not** touch the `mini.*`, `bot.*`, `charges.statusOpen/Paid/Cancelled`, `charges.type*`, or `charges.filter*` keys. Those are out of scope per the spec.

- [ ] **Step 2: Apply matching renames and add subtitle keys to `messages-ru.ts`**

Make exactly the following edits in `src/shared/i18n/messages-ru.ts`:

**Nav block:**
```diff
   nav: {
     dashboard: 'Главная',
     members: 'Участники',
-    charges: 'Начисления',
-    payments: 'Платежи',
+    charges: 'Долги',
+    payments: 'Поступления',
     guests: 'Гости',
-    spendings: 'Траты',
+    spendings: 'Расходы',
     info: 'Информация',
     settings: 'Настройки',
     adminBadge: '(админ)',
   },
```

**Members block:**
```diff
-    openCharges: 'Открытые начисления',
+    openCharges: 'Открытые долги',
```

**Charges block:**
```diff
   charges: {
-    title: 'Начисления',
-    newCharge: 'Новое начисление',
+    title: 'Долги',
+    subtitle: 'Что участники должны команде',
+    newCharge: 'Новый долг',
     filterAll: 'Все',
     filterOpen: 'Открытые',
     filterPaid: 'Оплачено',
     filterCancelled: 'Отменено',
-    none: 'Начислений нет.',
+    none: 'Долгов нет.',
```

```diff
-    newPageTitle: 'Новое начисление',
+    newPageTitle: 'Новый долг',
```

```diff
-    submitAdhoc: 'Создать начисление',
+    submitAdhoc: 'Создать долг',
     submitPotBorrow: 'Записать заём из кассы',
-    submitSplit: 'Создать разделённое начисление',
+    submitSplit: 'Создать разделённый долг',
```

**Payments block:**
```diff
   payments: {
-    title: 'Платежи',
+    title: 'Поступления',
+    subtitle: 'Деньги, полученные от участников',
     record: 'Записать платёж',
     none: 'Платежей нет.',
```

**Spendings block:**
```diff
   spendings: {
-    title: 'Траты',
-    record: 'Записать трату',
-    none: 'Трат нет.',
+    title: 'Расходы',
+    subtitle: 'Что команда потратила из касс',
+    record: 'Записать расход',
+    none: 'Расходов нет.',
     colPot: 'Касса',
     colDescription: 'Описание',
     colCategory: 'Категория',
     colAmount: 'Сумма',
     colWhen: 'Когда',
-    newPageTitle: 'Запись траты',
+    newPageTitle: 'Запись расхода',
     potLabel: 'Касса',
     amountLabel: 'Сумма',
     descriptionLabel: 'Описание',
     categoryLabel: 'Категория (необязательно)',
     categoryPlaceholder: 'Нет',
-    submit: 'Записать трату',
+    submit: 'Записать расход',
   },
```

**Note:** The RU strings for `spendings.none` and `spendings.newPageTitle` should be verified against the current file — open `src/shared/i18n/messages-ru.ts` and confirm the surrounding context matches before applying the diff. If the current RU value differs from what's shown here, keep the existing surrounding text and only change the words that appear in the rename map.

- [ ] **Step 3: Run i18n parity test**

Run: `pnpm vitest run tests/shared/i18n-catalog-parity.test.ts`
Expected: PASS — both "EN and RU have identical key sets" and "EN and RU have matching shapes per key" should pass.

If FAIL with "keys missing in RU" mentioning `*.subtitle`, the RU catalog is missing one of the three new subtitle keys — re-check Step 2.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS. If FAIL with "Property 'subtitle' is missing in type", the RU catalog is missing a key from the EN catalog.

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts
git commit -m "feat(i18n): rename Charges/Payments/Spendings and add page subtitles"
```

---

## Task 3: Wire subtitles on the three pages

**Files:**
- Modify: `src/app/(app)/charges/page.tsx`
- Modify: `src/app/(app)/payments/page.tsx`
- Modify: `src/app/(app)/spendings/page.tsx`

Each page renders a `<PageHeader title={m.<page>.title} actions={...} />`. Add `subtitle={m.<page>.subtitle}` to each.

- [ ] **Step 1: Update charges/page.tsx**

In `src/app/(app)/charges/page.tsx`, find:

```tsx
      <PageHeader
        title={m.charges.title}
        actions={me.role === 'admin' ? <LinkButton href="/charges/new">{m.charges.newCharge}</LinkButton> : null}
      />
```

Replace with:

```tsx
      <PageHeader
        title={m.charges.title}
        subtitle={m.charges.subtitle}
        actions={me.role === 'admin' ? <LinkButton href="/charges/new">{m.charges.newCharge}</LinkButton> : null}
      />
```

- [ ] **Step 2: Update payments/page.tsx**

In `src/app/(app)/payments/page.tsx`, find:

```tsx
      <PageHeader
        title={m.payments.title}
        actions={me.role === 'admin' ? <LinkButton href="/payments/new">{m.payments.record}</LinkButton> : null}
      />
```

Replace with:

```tsx
      <PageHeader
        title={m.payments.title}
        subtitle={m.payments.subtitle}
        actions={me.role === 'admin' ? <LinkButton href="/payments/new">{m.payments.record}</LinkButton> : null}
      />
```

- [ ] **Step 3: Update spendings/page.tsx**

In `src/app/(app)/spendings/page.tsx`, find:

```tsx
      <PageHeader
        title={m.spendings.title}
        actions={me.role === 'admin' ? <LinkButton href="/spendings/new">{m.spendings.record}</LinkButton> : null}
      />
```

Replace with:

```tsx
      <PageHeader
        title={m.spendings.title}
        subtitle={m.spendings.subtitle}
        actions={me.role === 'admin' ? <LinkButton href="/spendings/new">{m.spendings.record}</LinkButton> : null}
      />
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Run full unit-test suite**

Run: `pnpm test`
Expected: PASS — including the i18n parity test.

- [ ] **Step 6: Visual verification in dev server**

Start the dev server: `pnpm dev`
Open `http://localhost:3000/charges`, `/payments`, `/spendings` in a browser (signed in as an admin).
Verify on each page:
  - The H1 shows the new title (Debts / Payments in / Expenses).
  - A muted one-line subtitle appears directly under the H1.
  - The right-side action button (e.g. "+ New debt") is vertically centered against the title.
  - Switch the language using the `LanguageSwitcher` in the header and re-verify each page shows the RU equivalents (Долги / Поступления / Расходы) with their subtitles.

If the dev server cannot be started (e.g. headless agent), skip this step but note it in the commit message and surface to the user.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/charges/page.tsx src/app/\(app\)/payments/page.tsx src/app/\(app\)/spendings/page.tsx
git commit -m "feat(web): show subtitles under page headings on Debts/Payments/Expenses"
```

---

## Task 4: Final verification

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: PASS — Next.js production build completes without TypeScript or lint errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: Confirm git status is clean**

Run: `git status`
Expected: `working tree clean` (all renames committed across the three tasks).

- [ ] **Step 4: Show recent commits**

Run: `git log --oneline -5`
Expected (in order, newest first):
```
<hash> feat(web): show subtitles under page headings on Debts/Payments/Expenses
<hash> feat(i18n): rename Charges/Payments/Spendings and add page subtitles
<hash> feat(ui): add optional subtitle to PageHeader
<hash> docs: spec for web UI naming clarity
<hash> fix(web): simplify guest-deposit submit disabled condition
```

---

## Out of scope (do not change in this plan)

- Telegram Mini App strings (`mini.*` in i18n)
- Bot strings (`bot.*` in i18n, including help text and command descriptions)
- URL paths — `/charges`, `/payments`, `/spendings` remain
- DB schema, server actions, domain types
- "Pot" / "Cash pot" / "Card pot" vocabulary
- Dashboard, Members, Guests, Settings, Info page headings (no subtitles added yet; the prop exists for future use)
