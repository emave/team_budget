# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename and regroup the top-level routes around money flow (Owed / Received / Spent / People / Handbook / History), absorbing `Deposits` into `Received` and `Guests` into `People`, while leaving the domain, DB schema, and bot untouched.

**Architecture:** Each task migrates one route family across both route trees (`src/app/(app)/*` and `src/app/(mini)/mini/*`) atomically: folder move + i18n namespace rename + sidebar/tab entry + every in-tree link + dependent tests. Ends with a `pnpm typecheck` pass and a commit. After all routes are migrated, a final task adds 308 redirects in `next.config.mjs` and updates the README smoke-check.

**Tech Stack:** Next.js App Router (file-system routing), TypeScript (typed i18n bundle catches missed key references), Vitest, pnpm.

**Spec:** [docs/superpowers/specs/2026-05-25-navigation-redesign-design.md](../specs/2026-05-25-navigation-redesign-design.md)

---

## Conventions for every task

- Use `git mv` for folder moves so history follows.
- After any rename, run `pnpm typecheck` before committing. The i18n bundle is typed (`Messages = typeof MESSAGES_EN`), so removed keys surface as type errors at every call site.
- `pnpm test` (vitest, fast) should also stay green.
- Keep one task per commit. Commit messages: `refactor(nav): rename <old> → <new>`.
- The data layer (`src/server/domain/*`, DB schema, drizzle migrations, bot conversations and strings) is **off-limits**. If a task instruction would require touching them, stop and re-read the spec.

---

## Task 1: Rename `/info` → `/handbook`

**Smallest, most isolated rename. Establishes the pattern.**

**Files:**
- Move: `src/app/(app)/info/` → `src/app/(app)/handbook/`
- Move: `src/app/(mini)/mini/info/` → `src/app/(mini)/mini/handbook/`
- Modify: `src/app/(app)/_components/app-shell.tsx` (nav array)
- Modify: `src/app/(mini)/mini/tabs.tsx` (`matchPrefixes` only — `/mini/info` is currently inside `More`)
- Modify: `src/app/(mini)/mini/more/page.tsx` (link href + label)
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`

### Steps

- [ ] **Step 1: Move the web route folder**

```bash
git mv src/app/\(app\)/info src/app/\(app\)/handbook
```

- [ ] **Step 2: Move the mini route folder**

```bash
git mv src/app/\(mini\)/mini/info src/app/\(mini\)/mini/handbook
```

- [ ] **Step 3: Rename the i18n namespace in EN**

In `src/shared/i18n/messages-en.ts`:
- Change the top-level `info: { … }` key to `handbook: { … }` (find the `info:` block around line 277).
- Inside `nav: { … }` (line 6), rename `info: 'Info'` → `handbook: 'Handbook'`.
- The `LanguageSwitcher` and bot-related `info` references elsewhere (e.g. inside `bot:`) are **bot strings, not nav** — leave them untouched.

- [ ] **Step 4: Rename the i18n namespace in RU**

Same edits in `src/shared/i18n/messages-ru.ts`. The RU label is `'Справка'`.

```typescript
// nav block:
handbook: 'Справка',
```

- [ ] **Step 5: Update the web sidebar nav array**

In `src/app/(app)/_components/app-shell.tsx`, replace the Info entry:

```typescript
// OLD
{ href: '/info', label: m.nav.info, Icon: NavInfoIcon },

// NEW
{ href: '/handbook', label: m.nav.handbook, Icon: NavInfoIcon },
```

(Icon stays — visual continuity. We're renaming the label, not the iconography.)

- [ ] **Step 6: Update the mini `More` page link**

In `src/app/(mini)/mini/more/page.tsx`:

```typescript
// OLD
<MiniLinkRow
  href="/mini/info"
  title={<>ℹ️ {m.mini.infoTitle}</>}
  subtitle={<span>{m.mini.moreOnInfo}</span>}
/>

// NEW
<MiniLinkRow
  href="/mini/handbook"
  title={<>ℹ️ {m.mini.infoTitle}</>}
  subtitle={<span>{m.mini.moreOnInfo}</span>}
/>
```

(Leave `m.mini.infoTitle` / `m.mini.moreOnInfo` keys alone — they belong to the mini namespace, not nav. Their values can be updated to "Handbook" wording in EN / "Справка" in RU as part of Step 4, but the key names stay stable for now.)

- [ ] **Step 7: Update the `matchPrefixes` in `MiniTabs`**

In `src/app/(mini)/mini/tabs.tsx`, the `/mini/info` entry inside `matchPrefixes` for the `More` tab:

```typescript
matchPrefixes: [
  '/mini/more',
  '/mini/handbook',   // was '/mini/info'
  '/mini/spendings',
  '/mini/guests',
  '/mini/settings',
  '/mini/history',
],
```

- [ ] **Step 8: Update any other `href`/import references**

Search the codebase:

```bash
grep -rn --include="*.ts" --include="*.tsx" -E "(/info|m\.info\.|\binfo:)" src
```

Update remaining `href="/info"`, `href="/mini/info"`, and `m.info.*` references to `/handbook`, `/mini/handbook`, `m.handbook.*`. Bot files (`src/server/bot/*`) are **off-limits** — leave them alone even if they match.

- [ ] **Step 9: Run typecheck + tests**

```bash
pnpm typecheck && pnpm test
```

Expected: both pass. If `pnpm typecheck` complains about missing `m.info.*` keys, you have leftover references. Fix them.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(nav): rename /info → /handbook"
```

---

## Task 2: Promote `/dashboard/history` → `/history`

**Web only — the mini app already has `/mini/history` at top level.**

**Files:**
- Move: `src/app/(app)/dashboard/history/` → `src/app/(app)/history/`
- Modify: `src/app/(app)/_components/app-shell.tsx` (add History to nav)
- Modify: `src/app/(app)/dashboard/page.tsx` (the "view history" link)
- Modify: `src/shared/i18n/messages-en.ts` (add `nav.history`)
- Modify: `src/shared/i18n/messages-ru.ts` (add `nav.history`)

### Steps

- [ ] **Step 1: Move the route folder**

```bash
git mv src/app/\(app\)/dashboard/history src/app/\(app\)/history
```

- [ ] **Step 2: Add `nav.history` to EN bundle**

In `src/shared/i18n/messages-en.ts`, inside `nav: { … }`:

```typescript
nav: {
  dashboard: 'Dashboard',
  members: 'Members',
  // …
  handbook: 'Handbook',  // from Task 1
  history: 'History',    // NEW
  settings: 'Settings',
  // …
},
```

- [ ] **Step 3: Add `nav.history` to RU bundle**

In `src/shared/i18n/messages-ru.ts`:

```typescript
history: 'История',
```

- [ ] **Step 4: Insert the History nav entry (admin only)**

In `src/app/(app)/_components/app-shell.tsx`, the History item is admin-only (matches existing route gating). Add it to `adminExtras`:

```typescript
const adminExtras: NavItem[] = [
  { href: '/history', label: m.nav.history, Icon: NavInfoIcon /* placeholder; see Step 5 */ },
  { href: '/guests', label: m.nav.guests, Icon: NavGuestsIcon },
  { href: '/deposits', label: m.nav.deposits, Icon: NavDepositsIcon },
  { href: '/settings', label: m.nav.settings, Icon: NavSettingsIcon },
];
```

- [ ] **Step 5: Choose a History icon**

Inspect `src/ui/icons.ts` (or wherever `NavInfoIcon` etc. live). If there's no obvious history/clock icon already exported, reuse the most fitting one (e.g. `NavInfoIcon`) — adding a new icon is out of scope. Note in the commit message which icon you picked.

```bash
grep -n "^export.*Nav" src/ui/icons.ts | head -20
```

- [ ] **Step 6: Update the dashboard "view history" link**

In `src/app/(app)/dashboard/page.tsx`, line ~68:

```typescript
// OLD
<Link href="/dashboard/history">{m.dashboard.viewHistory}</Link>

// NEW
<Link href="/history">{m.dashboard.viewHistory}</Link>
```

- [ ] **Step 7: Verify no other references**

```bash
grep -rn "/dashboard/history" src
```

Expected: empty.

- [ ] **Step 8: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(nav): promote /dashboard/history → /history"
```

---

## Task 3: Rename `/charges` → `/owed`

**Files:**
- Move: `src/app/(app)/charges/` → `src/app/(app)/owed/`
- Move: `src/app/(mini)/mini/charges/` → `src/app/(mini)/mini/owed/`
- Rename: `src/app/(app)/owed/charges-table.tsx` → `owed-table.tsx`
- Modify: `src/app/(app)/owed/page.tsx`, `src/app/(app)/owed/new/page.tsx`, etc. (internal hrefs + import paths)
- Modify: `src/app/(mini)/mini/owed/page.tsx` (internal hrefs)
- Modify: `src/app/(app)/_components/app-shell.tsx`
- Modify: `src/app/(mini)/mini/tabs.tsx`
- Modify: `src/shared/i18n/messages-en.ts`, `messages-ru.ts`
- Modify: `tests/shared/mini-charges-filter.test.ts` (import path)
- Inspect: `src/app/(app)/members/[id]/...` — the member detail page uses `OpenChargesTable` from a sibling file; **not affected** by this rename.

### Steps

- [ ] **Step 1: Move both folders**

```bash
git mv src/app/\(app\)/charges src/app/\(app\)/owed
git mv src/app/\(mini\)/mini/charges src/app/\(mini\)/mini/owed
```

- [ ] **Step 2: Rename the component file**

```bash
git mv src/app/\(app\)/owed/charges-table.tsx src/app/\(app\)/owed/owed-table.tsx
```

In `src/app/(app)/owed/owed-table.tsx`, rename the exported symbol:

```typescript
// OLD
export function ChargesTable({ rows }: { rows: ChargeRow[] }) {
// NEW
export function OwedTable({ rows }: { rows: ChargeRow[] }) {
```

Keep `ChargeRow` as the row type name — it's the shape of a charge record from the domain. Renaming `ChargeRow` would just churn types without clarity.

- [ ] **Step 3: Update the page imports and component usage**

In `src/app/(app)/owed/page.tsx`:

```typescript
// OLD
import { ChargesTable, type ChargeRow } from './charges-table';
// NEW
import { OwedTable, type ChargeRow } from './owed-table';
```

And usage `<ChargesTable rows={shaped} />` → `<OwedTable rows={shaped} />`.

- [ ] **Step 4: Update internal `Link` hrefs**

In `src/app/(app)/owed/page.tsx`:

```typescript
<LinkButton href="/owed/new" startEnhancer={<ActionNewIcon />}>  // was /charges/new
{m.owed.newCharge}                                                // was m.charges.newCharge — see Step 6
</LinkButton>
```

And the four filter links:

```typescript
<Link href="/owed">{m.owed.filterAll}</Link>
<Link href="/owed?status=open">{m.owed.filterOpen}</Link>
<Link href="/owed?status=paid">{m.owed.filterPaid}</Link>
<Link href="/owed?status=cancelled">{m.owed.filterCancelled}</Link>
```

Same sweep in `src/app/(app)/owed/new/page.tsx`, `src/app/(app)/owed/cancel-button.tsx`, `src/app/(app)/owed/pay-from-credit-button.tsx`, and `src/app/(app)/owed/new/*-form.tsx`.

- [ ] **Step 5: Update the mini side**

In `src/app/(mini)/mini/owed/page.tsx`, `new/page.tsx`, `new/new-charge-form.tsx`, and `filter.ts`:

```typescript
// every literal '/mini/charges...' → '/mini/owed...'
// every router.push('/mini/charges') → router.push('/mini/owed')
// every MiniBack href → '/mini/owed'
```

- [ ] **Step 6: Rename the i18n namespace `charges` → `owed`**

In both `messages-en.ts` and `messages-ru.ts`:
- Rename the top-level `charges: { … }` block to `owed: { … }`.
- Inside the block, leave keys like `newCharge`, `filterAll`, etc. as-is (they describe content, not the noun).
- In `nav:`, rename `charges:` → `owed:`. EN value: `'Debts'` → `'Owed'`. RU value: `'Долги'` (unchanged — already accurate).

- [ ] **Step 7: Update the web sidebar nav array**

In `src/app/(app)/_components/app-shell.tsx`:

```typescript
{ href: '/owed', label: m.nav.owed, Icon: NavDebtsIcon },  // was /charges, m.nav.charges
```

- [ ] **Step 8: Update mini bottom tabs**

In `src/app/(mini)/mini/tabs.tsx`:

```typescript
{ href: '/mini/owed', label: m.mini.tabOwed, matchPrefixes: ['/mini/owed'] },
```

Rename the key `m.mini.tabCharges` → `m.mini.tabOwed` in both bundles for consistency. Update values: EN `'Owed'`, RU `'Долги'`.

- [ ] **Step 9: Update the test import path**

In `tests/shared/mini-charges-filter.test.ts`:

```typescript
// OLD
import { parseChargesStatusParam } from '@/app/(mini)/mini/charges/filter';
// NEW
import { parseChargesStatusParam } from '@/app/(mini)/mini/owed/filter';
```

The function name itself (`parseChargesStatusParam`) stays — it parses a charge-status param, which is still semantically a charge in the domain.

- [ ] **Step 10: Sweep for stragglers**

```bash
grep -rn --include="*.ts" --include="*.tsx" -E "(/charges|m\.charges\.|\bcharges:|ChargesTable)" src tests
```

Expected: zero hits in `src/app/` or in `tests/shared/`. Hits inside `src/server/domain/charges.ts` or `tests/integration/money-flow.test.ts` are expected — those are **domain** references, off-limits.

- [ ] **Step 11: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(nav): rename /charges → /owed"
```

---

## Task 4: Rename `/spendings` → `/spent`

**Same shape as Task 3 — apply the pattern.**

**Files:**
- Move: `src/app/(app)/spendings/` → `src/app/(app)/spent/`
- Move: `src/app/(mini)/mini/spendings/` → `src/app/(mini)/mini/spent/`
- Rename: `src/app/(app)/spent/spendings-table.tsx` → `spent-table.tsx`
- Modify: `src/app/(app)/_components/app-shell.tsx`, `src/app/(mini)/mini/tabs.tsx`, `src/app/(mini)/mini/more/page.tsx`
- Modify: `src/shared/i18n/messages-en.ts`, `messages-ru.ts`

### Steps

- [ ] **Step 1: Move folders**

```bash
git mv src/app/\(app\)/spendings src/app/\(app\)/spent
git mv src/app/\(mini\)/mini/spendings src/app/\(mini\)/mini/spent
```

- [ ] **Step 2: Rename the table component file**

```bash
git mv src/app/\(app\)/spent/spendings-table.tsx src/app/\(app\)/spent/spent-table.tsx
```

In `spent-table.tsx`, rename the export `SpendingsTable` → `SpentTable`. Row type `SpendingRow` stays (it's a domain shape).

- [ ] **Step 3: Update page imports and component usage**

In `src/app/(app)/spent/page.tsx`:

```typescript
import { SpentTable, type SpendingRow } from './spent-table';
// …
<SpentTable rows={shaped} />
```

- [ ] **Step 4: Update internal hrefs**

In `src/app/(app)/spent/page.tsx`:

```typescript
<LinkButton href="/spent/new" startEnhancer={<ActionNewIcon />}>
  {m.spent.record}
</LinkButton>
```

And in `src/app/(app)/spent/new/record-form.tsx`, any `router.push('/spendings')` → `router.push('/spent')`. Same for `src/app/(app)/spent/cancel-button.tsx`.

- [ ] **Step 5: Update mini side**

In `src/app/(mini)/mini/spent/page.tsx`, `new/page.tsx`, and `new/record-form.tsx`:

```typescript
// every '/mini/spendings...' → '/mini/spent...'
```

- [ ] **Step 6: Rename i18n namespace `spendings` → `spent`**

In both `messages-en.ts` and `messages-ru.ts`:
- Top-level `spendings: { … }` → `spent: { … }`.
- `nav.spendings` → `nav.spent`. EN value: `'Expenses'` → `'Spent'`. RU value: `'Расходы'` (unchanged).

- [ ] **Step 7: Update sidebar nav**

In `src/app/(app)/_components/app-shell.tsx`:

```typescript
{ href: '/spent', label: m.nav.spent, Icon: NavExpensesIcon },
```

- [ ] **Step 8: Add Spent to the mini bottom tabs**

In `src/app/(mini)/mini/tabs.tsx`, change the five tabs to: Home, Owed, Payments (intermediate — Task 5 will rename to Received), Spent, More. The Members tab disappears from the bar (People will live in More after Task 6, per spec Section 2):

```typescript
const tabs: Tab[] = [
  { href: '/mini', label: m.mini.tabHome },
  { href: '/mini/owed', label: m.mini.tabOwed, matchPrefixes: ['/mini/owed'] },
  { href: '/mini/payments', label: m.mini.tabPayments, matchPrefixes: ['/mini/payments', '/mini/deposits'] },
  { href: '/mini/spent', label: m.mini.tabSpent, matchPrefixes: ['/mini/spent'] },
  {
    href: '/mini/more',
    label: m.mini.tabMore,
    matchPrefixes: ['/mini/more', '/mini/handbook', '/mini/members', '/mini/guests', '/mini/settings', '/mini/history'],
  },
];
```

(`/mini/members` and `/mini/guests` stay in `matchPrefixes` until Task 6 collapses them into `/mini/people`.)

Add `tabSpent` to both i18n bundles (EN: 'Spent', RU: 'Расходы').

- [ ] **Step 9: Remove Spent from `More`**

In `src/app/(mini)/mini/more/page.tsx`, drop the Spendings entry (now on the bar) and update the href:

Delete this block:

```typescript
<MiniLinkRow
  href="/mini/spendings"
  title={<>🛒 {m.nav.spendings}</>}
  subtitle={<span>{m.mini.moreOnSpendings}</span>}
/>
```

- [ ] **Step 10: Sweep**

```bash
grep -rn --include="*.ts" --include="*.tsx" -E "(/spendings|m\.spendings\.|\bspendings:|SpendingsTable)" src
```

Expected: zero in `src/app/`. Hits in `src/server/domain/spendings.ts` are fine.

- [ ] **Step 11: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(nav): rename /spendings → /spent, promote to mini bottom bar"
```

---

## Task 5: Merge `/payments` + `/deposits` → `/received`

**Biggest merge. The current `/deposits` page already does the multi-tab feed — it just needs to be renamed and absorb the simpler `/payments` page.**

**Files:**
- Move: `src/app/(app)/deposits/` → `src/app/(app)/received/`
- Delete: `src/app/(app)/payments/` (after lifting its `/new` and `/guest` flows into `/received/`)
- Move: `src/app/(mini)/mini/deposits/` → `src/app/(mini)/mini/received/`
- Lift mini: `src/app/(mini)/mini/payments/new/*` → `src/app/(mini)/mini/received/new/*`
- Lift mini: `src/app/(mini)/mini/payments/guest/*` → `src/app/(mini)/mini/received/guest/*`
- Delete: `src/app/(mini)/mini/payments/`
- Rename: `src/app/(app)/received/deposits-view.tsx` → `received-view.tsx` (export `ReceivedView`)
- Modify: i18n bundles (merge `payments` and `deposits` namespaces into `received`)
- Modify: `src/app/(app)/_components/app-shell.tsx`, `src/app/(mini)/mini/tabs.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(mini)/mini/page.tsx` (recent-items links if any)

### Steps

- [ ] **Step 1: Move `/deposits` → `/received`**

```bash
git mv src/app/\(app\)/deposits src/app/\(app\)/received
git mv src/app/\(app\)/received/deposits-view.tsx src/app/\(app\)/received/received-view.tsx
git mv src/app/\(mini\)/mini/deposits src/app/\(mini\)/mini/received
```

In `received-view.tsx`, rename export `DepositsView` → `ReceivedView`. Keep `PersonOption` type name (generic).

- [ ] **Step 2: Lift `/payments/new` into `/received/new`**

```bash
git mv src/app/\(app\)/payments/new src/app/\(app\)/received/new
```

Inside the moved files, update any `router.push('/payments')` → `router.push('/received')`.

- [ ] **Step 3: Lift the mini `/mini/payments/new` and `/mini/payments/guest`**

```bash
git mv src/app/\(mini\)/mini/payments/new src/app/\(mini\)/mini/received/new
git mv src/app/\(mini\)/mini/payments/guest src/app/\(mini\)/mini/received/guest
```

Same internal `router.push` updates.

- [ ] **Step 4: Delete obsolete `/payments` directories**

Before deleting, sanity-check the leftover content:

```bash
ls src/app/\(app\)/payments
ls src/app/\(mini\)/mini/payments
```

Each should have only `page.tsx`, `payments-table.tsx`, `cancel-button.tsx` (or similar) — content that the unified `/received/page.tsx` now covers. Delete:

```bash
git rm -r src/app/\(app\)/payments
git rm -r src/app/\(mini\)/mini/payments
```

- [ ] **Step 5: Update `/received/page.tsx` to update import + component name**

In `src/app/(app)/received/page.tsx`:

```typescript
// OLD
import { DepositsView, type PersonOption } from './deposits-view';
// …
<DepositsView … />

// NEW
import { ReceivedView, type PersonOption } from './received-view';
// …
<ReceivedView … />
```

Page header label uses `m.received.pageTitle` (see Step 7).

Update `LinkButton href="/payments/new"` (if any was in the old page) — the new `/received/page.tsx` should expose `+ Record` linking to `/received/new`.

- [ ] **Step 6: Update mini side**

In `src/app/(mini)/mini/received/page.tsx`, replace remaining `'/mini/deposits'` literals with `'/mini/received'`. In `filter-form.tsx` and any `router.push` call sites, same.

- [ ] **Step 7: Merge i18n namespaces `payments` + `deposits` → `received`**

In both `messages-en.ts` and `messages-ru.ts`:

1. Create a new top-level `received: { … }` namespace.
2. Move every key from `deposits:` into `received:` (the deposits view is the spine of the new page). For colliding keys (e.g. cancel-row labels), prefer the `deposits` value.
3. Move keys from `payments:` that the old `/payments/new` flow needs (form labels, success messages) into `received:`. Pick the most generic phrasing.
4. Delete the now-empty `payments:` and `deposits:` blocks.
5. In `nav:`, replace `payments` and `deposits` with a single `received` key. Drop `m.nav.deposits` entirely.

EN labels:
```typescript
nav: { …, received: 'Received', … },  // replaces 'Payments in' + 'Deposits'
received: { pageTitle: 'Received', /* merged keys here */ },
```

RU labels:
```typescript
nav: { …, received: 'Поступления', … },
received: { pageTitle: 'Поступления', /* merged keys here */ },
```

Also reconcile `m.guestDeposits.*` if any of those keys are referenced from the moved files — fold them into `m.received.*` and update the call sites.

- [ ] **Step 8: Update the web sidebar nav array**

In `src/app/(app)/_components/app-shell.tsx`:

```typescript
// remove the Payments and Deposits entries
// add a single Received entry
{ href: '/received', label: m.nav.received, Icon: NavPaymentsInIcon },
```

(Keep `NavPaymentsInIcon` for now — picking a "deposits" icon is out of scope; the icon reads as "money in" which still fits.)

- [ ] **Step 9: Update mini bottom tabs**

In `src/app/(mini)/mini/tabs.tsx`, rename the Payments tab to Received:

```typescript
{ href: '/mini/received', label: m.mini.tabReceived, matchPrefixes: ['/mini/received'] },
```

Drop `/mini/deposits` and `/mini/payments` from any `matchPrefixes` they still appear in. Rename the i18n key `m.mini.tabPayments` → `m.mini.tabReceived` in both bundles. EN value: `'Received'`. RU value: `'Поступления'`.

- [ ] **Step 10: Update mini `More` page**

In `src/app/(mini)/mini/more/page.tsx`, delete the Deposits entry (now folded into the Received tab on the bar):

```typescript
// DELETE
<MiniLinkRow
  href="/mini/deposits"
  title={<>🐖 {m.nav.deposits}</>}
  subtitle={<span>{m.mini.moreOnDeposits}</span>}
/>
```

- [ ] **Step 11: Update dashboard "recent items" links**

In `src/app/(mini)/mini/page.tsx` (the mini dashboard), the recent-items map currently builds icons for payments. The links themselves stay scoped to row-level cancel actions; no URL change needed unless the dashboard links into `/mini/payments`. Search and confirm:

```bash
grep -n "/mini/payments\|/mini/deposits" src/app/\(mini\)
```

Expected: no remaining references after this task.

- [ ] **Step 12: Sweep**

```bash
grep -rn --include="*.ts" --include="*.tsx" -E "(/payments|/deposits|m\.payments\.|m\.deposits\.|\bpayments:|\bdeposits:|PaymentsTable|DepositsView)" src
```

Expected: zero in `src/app/`. Hits in `src/server/domain/payments.ts` etc. are fine. Hits in `tests/integration/money-flow.test.ts` (importing from `@/server/domain/payments`) are fine.

- [ ] **Step 13: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "refactor(nav): merge /payments + /deposits → /received"
```

---

## Task 6: Merge `/members` + `/guests` → `/people` with tabs

**The other big merge. People is the new hub for everyone in the team finance flow, with Members / Guests sub-tabs.**

**Files:**
- Move: `src/app/(app)/members/` → `src/app/(app)/people/`
- Move guest content into a sub-tab: `src/app/(app)/people/_guests-tab.tsx` (lifted from `src/app/(app)/guests/`)
- Delete: `src/app/(app)/guests/`
- Move: `src/app/(mini)/mini/members/` → `src/app/(mini)/mini/people/`
- Move guest content into mini sub-tab: `src/app/(mini)/mini/people/_guests-tab.tsx`
- Delete: `src/app/(mini)/mini/guests/`
- Modify: `src/app/(app)/people/page.tsx` — add tab switching
- Modify: `src/app/(mini)/mini/people/page.tsx` — add tab switching
- Modify: dashboard pages (both `(app)` and `(mini)`) — `MembersTable` import paths
- Modify: i18n bundles (merge `members` + `guests` → `people`)
- Modify: `app-shell.tsx`, `mini/tabs.tsx`, `mini/more/page.tsx`

### Steps

- [ ] **Step 1: Move `/members` → `/people`**

```bash
git mv src/app/\(app\)/members src/app/\(app\)/people
git mv src/app/\(mini\)/mini/members src/app/\(mini\)/mini/people
```

Member-detail route stays at `src/app/(app)/people/[id]/` (inherited from the move).

- [ ] **Step 2: Lift guest UI into a sub-tab module (web)**

```bash
mkdir -p src/app/\(app\)/people/_guests
git mv src/app/\(app\)/guests/guests-table.tsx src/app/\(app\)/people/_guests/guests-table.tsx
git mv src/app/\(app\)/guests/new-guest-button.tsx src/app/\(app\)/people/_guests/new-guest-button.tsx
git mv src/app/\(app\)/guests/rename-button.tsx src/app/\(app\)/people/_guests/rename-button.tsx
git mv src/app/\(app\)/guests/archive-button.tsx src/app/\(app\)/people/_guests/archive-button.tsx
```

The `/guests/deposits/page.tsx` route content is no longer needed (it's absorbed by `/received?tab=guests` per spec). Delete:

```bash
git rm -r src/app/\(app\)/guests
```

- [ ] **Step 3: Same lift for mini**

```bash
mkdir -p src/app/\(mini\)/mini/people/_guests
git mv src/app/\(mini\)/mini/guests/*.tsx src/app/\(mini\)/mini/people/_guests/ 2>/dev/null || true
ls src/app/\(mini\)/mini/guests  # what's left
```

Inspect the leftover. Move the page-level helpers into `_guests/` and delete the directory:

```bash
git rm -r src/app/\(mini\)/mini/guests
```

- [ ] **Step 4: Rewrite `src/app/(app)/people/page.tsx` to host two tabs**

The new page reads a `tab` searchParam (`members` default, `guests` for the alternate tab), renders the tab strip, and dispatches to either the existing members section or the lifted guests section. Skeleton:

```typescript
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { listMemberCreditBalances } from '@/server/domain/credit';
import { users } from '@/server/db/schema';
import { listGuests } from '@/server/domain/guests';
import { listGuestDeposits } from '@/server/domain/guest-deposits';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import Link from 'next/link';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { SectionHeading } from '@/ui/heading';
import { InviteButton } from './invite-button';
import { MembersTable, type MemberRow } from './members-table';
import { PendingInvitesTable, type PendingInviteRow } from './pending-invites-table';
import { listPendingInvites } from '@/server/domain/invites';
import { GuestsTable, type GuestRow } from './_guests/guests-table';
import { NewGuestButton } from './_guests/new-guest-button';

type Tab = 'members' | 'guests';

export default async function PeoplePage(props: {
  searchParams?: Promise<{ tab?: string; archived?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const me = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = me.role === 'admin';
  const tab: Tab = sp.tab === 'guests' && isAdmin ? 'guests' : 'members';

  return (
    <div>
      <PageHeader
        title={m.people.title}
        actions={
          isAdmin ? (tab === 'members' ? <InviteButton /> : <NewGuestButton />) : null
        }
      />
      {isAdmin && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 13 }}>
          <Link href="/people">{m.people.tabMembers}</Link>
          <Link href="/people?tab=guests">{m.people.tabGuests}</Link>
        </div>
      )}
      {tab === 'members' ? (
        <MembersSection db={db} m={m} isAdmin={isAdmin} />
      ) : (
        <GuestsSection db={db} m={m} locale={locale} archived={sp.archived === '1'} />
      )}
    </div>
  );
}

async function MembersSection({ db, m, isAdmin }: { db: ReturnType<typeof getDb>; m: ReturnType<typeof getMessages>; isAdmin: boolean }) {
  const all = db.select().from(users).all();
  const [debts, credits] = await Promise.all([
    Promise.all(all.map((u) => getMemberOutstandingDebt(db, u.id))),
    listMemberCreditBalances(db),
  ]);
  const creditByUser = new Map(credits.map((c) => [c.userId, c.balance]));
  const shaped: MemberRow[] = all.map((u, i) => {
    const debt = debts[i] ?? 0;
    const credit = creditByUser.get(u.id) ?? 0;
    return {
      id: u.id,
      displayName: u.displayName,
      role: u.role as 'admin' | 'member',
      isActive: u.isActive,
      debtFormatted: debt > 0 ? formatCents(debt) : null,
      creditFormatted: credit > 0 ? formatCents(credit) : null,
    };
  });
  const pendingInvites: PendingInviteRow[] = isAdmin
    ? (await listPendingInvites(db)).map((i) => ({
        id: i.id, token: i.token, displayNameHint: i.displayNameHint, createdAt: i.createdAt,
      }))
    : [];
  return (
    <>
      <Panel marginBottom={isAdmin ? 16 : 0}>
        <MembersTable rows={shaped} />
      </Panel>
      {isAdmin && (
        <Panel>
          <SectionHeading>{m.people.pendingInvitesTitle}</SectionHeading>
          <PendingInvitesTable rows={pendingInvites} />
        </Panel>
      )}
    </>
  );
}

async function GuestsSection(
  { db, m, locale, archived }: { db: ReturnType<typeof getDb>; m: ReturnType<typeof getMessages>; locale: 'en' | 'ru'; archived: boolean },
) {
  const guests = await listGuests(db, { includeArchived: archived });
  const deposits = await listGuestDeposits(db, {});
  const byGuest = new Map<string | null, { total: number; count: number; last: string | null }>();
  for (const d of deposits) {
    const cur = byGuest.get(d.guestId) ?? { total: 0, count: 0, last: null };
    cur.total += d.amount;
    cur.count += 1;
    if (!cur.last || d.receivedAt > cur.last) cur.last = d.receivedAt;
    byGuest.set(d.guestId, cur);
  }
  const rows: GuestRow[] = guests.map((g) => {
    const agg = byGuest.get(g.id) ?? { total: 0, count: 0, last: null };
    return {
      id: g.id,
      name: g.name,
      archived: g.archived,
      totalFormatted: formatCents(agg.total),
      count: agg.count,
      lastFormatted: agg.last ? formatDate(agg.last, locale) : '—',
    };
  });
  return (
    <>
      <Panel>
        <GuestsTable rows={rows} />
      </Panel>
      <div style={{ marginTop: 12 }}>
        <a href={archived ? '/people?tab=guests' : '/people?tab=guests&archived=1'}>
          {m.people.showArchivedGuests}
        </a>
      </div>
    </>
  );
}
```

(The two section helpers stay in the same file — they're small, only used here.)

- [ ] **Step 5: Mirror the page for mini**

The mini people page should follow the same pattern: read `searchParams.tab`, switch between Members feed and Guests feed, with a `mini-filterbar` tab strip on top (admin only). Use the existing `src/app/(mini)/mini/people/page.tsx` (already moved in Step 1) as the structural base — it already renders the Members feed; you're adding the Guests branch.

Concrete diff:

1. Update the function signature to accept `searchParams`:

   ```typescript
   export default async function MiniPeoplePage(props: {
     searchParams?: Promise<{ tab?: string; archived?: string }>;
   }) {
     const sp = (await props.searchParams) ?? {};
     // …
     const isAdmin = me.role === 'admin';
     const tab: 'members' | 'guests' = sp.tab === 'guests' && isAdmin ? 'guests' : 'members';
   ```

2. Above the existing members list, insert the tab strip (admin only):

   ```tsx
   {isAdmin && (
     <div className="mini-filterbar">
       <Link href="/mini/people" data-active={tab === 'members'}>{m.people.tabMembers}</Link>
       <Link href="/mini/people?tab=guests" data-active={tab === 'guests'}>{m.people.tabGuests}</Link>
     </div>
   )}
   ```

3. Wrap the existing `MiniSection` containing the members feed in `tab === 'members' && (…)`.

4. Below, add the guests branch: `tab === 'guests' && (<GuestsFeed … />)`. Implement `GuestsFeed` as an inline async component (same pattern as web Step 4's `GuestsSection`) that fetches guests + aggregates and renders one `MiniLinkRow` per guest using the moved `GuestsTable` data shape. If `GuestsTable` is web-only DOM, instead render the rows directly with `MiniRow`/`MiniBadge` using the aggregated guest data — do **not** import `GuestsTable` into the mini page.

5. The new-guest action: on the Guests tab, add a `MiniLinkButton` to the existing mini "new guest" flow (whose page lives at `src/app/(mini)/mini/people/_guests/...` after Step 3 of this task, or — if no such mini flow exists today — link to the web `/people?tab=guests` and document the gap in the commit message).

Verify before moving on: open the file and confirm both `tab === 'members'` and `tab === 'guests'` branches exist and the tab strip is gated on `isAdmin`.

- [ ] **Step 6: Update dashboard imports**

In `src/app/(app)/dashboard/page.tsx`:

```typescript
// OLD
import { MembersTable, type MemberRow } from '../members/members-table';
// NEW
import { MembersTable, type MemberRow } from '../people/members-table';
```

In `src/app/(mini)/mini/page.tsx`, change the recent-items `MiniLinkRow` href:

```typescript
href={`/mini/people/${mm.id}`}   // was /mini/members/${mm.id}
```

- [ ] **Step 7: Update inner links inside the moved trees**

Walk every `Link href`, `MiniBack href`, `MiniLinkButton href`, `router.push`, `redirect()` call inside `src/app/(app)/people/**` and `src/app/(mini)/mini/people/**`. Replace:

- `/members` → `/people`
- `/members/[id]` → `/people/[id]`
- `/members/invite` → `/people/invite`
- `/mini/members` (and sub-paths) → `/mini/people`
- `/guests` → `/people?tab=guests`
- `/mini/guests` → `/mini/people?tab=guests`

Also update the redirect inside the moved invite page (mini side has `MiniBack href="/mini/members"`).

- [ ] **Step 8: Merge i18n namespaces `members` + `guests` → `people`**

In both bundles:
- Create `people: { … }` containing every key from the old `members:` block.
- Pull guest-specific keys (`pageTitle`, `showArchived`, `archivedSuffix`, table headers, modal labels) under `people.guests.*` or merge into `people.*` with descriptive names.
- Add `people.title`, `people.tabMembers`, `people.tabGuests`, `people.showArchivedGuests`, `people.pendingInvitesTitle` (lifted from `members.pendingInvitesTitle`).
- In `nav:`, rename `members` → `people` and drop `guests`. EN: `'Members'` → `'People'`. RU: `'Участники'` → `'Люди'`.

Sweep all `m.members.*` and `m.guests.*` references in `src/app/` and update them to `m.people.*`. Domain references (e.g. `m.members.*` in bot files) are off-limits — bot keys stay where they are; if any bot string lives under `members:` and gets accidentally moved, restore it.

Actually safer: keep a separate `m.bot.*` namespace for all bot strings (per project convention seen in `m.bot.infoEdit`). Confirm by grepping:

```bash
grep -n "m\.members\.\|m\.guests\." src/server/bot
```

If empty: the bot does not consume `m.members.*` / `m.guests.*`, so the rename is safe.

- [ ] **Step 9: Update `app-shell.tsx` and `mini/tabs.tsx`**

In the web sidebar:

```typescript
// OLD
{ href: '/members', label: m.nav.members, Icon: NavMembersIcon },
// NEW
{ href: '/people', label: m.nav.people, Icon: NavMembersIcon },
```

Drop the Guests entry from `adminExtras`.

In `mini/tabs.tsx`: the Members tab is no longer on the bottom bar (replaced by Spent in Task 4 / Received in Task 5). Confirm tabs are:

```typescript
const tabs: Tab[] = [
  { href: '/mini', label: m.mini.tabHome },
  { href: '/mini/owed', label: m.mini.tabCharges, matchPrefixes: ['/mini/owed'] },
  { href: '/mini/received', label: m.mini.tabReceived, matchPrefixes: ['/mini/received'] },
  { href: '/mini/spent', label: m.mini.tabSpent, matchPrefixes: ['/mini/spent'] },
  {
    href: '/mini/more',
    label: m.mini.tabMore,
    matchPrefixes: ['/mini/more', '/mini/people', '/mini/handbook', '/mini/settings', '/mini/history'],
  },
];
```

(Note: `/mini/people` now in the `More` matchPrefixes since People is reached via More.)

- [ ] **Step 10: Update `mini/more/page.tsx` to the new four-item layout**

Replace the body with:

```typescript
return (
  <>
    <MiniInit />
    <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
      {m.mini.moreTitle}
    </h2>

    <MiniSection>
      <MiniLinkRow
        href="/mini/people"
        title={<>👤 {m.nav.people}</>}
        subtitle={<span>{m.mini.moreOnPeople}</span>}
      />
      {isAdmin && (
        <MiniLinkRow
          href="/mini/history"
          title={<>📈 {m.mini.viewHistory}</>}
          subtitle={<span>{m.mini.moreOnHistory}</span>}
        />
      )}
      <MiniLinkRow
        href="/mini/handbook"
        title={<>ℹ️ {m.mini.infoTitle}</>}
        subtitle={<span>{m.mini.moreOnInfo}</span>}
      />
      {isAdmin && (
        <MiniLinkRow
          href="/mini/settings"
          title={<>⚙️ {m.nav.settings}</>}
          subtitle={<span>{m.mini.moreOnSettings}</span>}
        />
      )}
    </MiniSection>

    <MiniTabs />
  </>
);
```

Drop the `activitySection`, `adminSection`, `teamSection` sub-headings (no longer needed). Add `m.mini.moreOnPeople` to both bundles.

- [ ] **Step 11: Sweep**

```bash
grep -rn --include="*.ts" --include="*.tsx" -E "(/members|/guests|m\.members\.|m\.guests\.|\bmembers:|\bguests:)" src
```

Expected: zero in `src/app/`. `src/server/domain/users.ts`, `src/server/domain/guests.ts`, `src/server/bot/*` are off-limits and may legitimately match.

- [ ] **Step 12: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor(nav): merge /members + /guests → /people with tabs"
```

---

## Task 7: Verify mini app shell is fully migrated

**No new content — this is a verification pass to catch anything earlier tasks missed in the mini app navigation.**

**Files:**
- Inspect: `src/app/(mini)/mini/tabs.tsx`, `src/app/(mini)/mini/more/page.tsx`, `src/app/(mini)/mini/page.tsx`
- Inspect: `src/app/(mini)/mini/init.tsx`, `auth-gate.tsx` (any hardcoded paths)

### Steps

- [ ] **Step 1: Verify bottom tabs are the new five**

`src/app/(mini)/mini/tabs.tsx` should list exactly: `/mini`, `/mini/owed`, `/mini/received`, `/mini/spent`, `/mini/more`. Anything else is a bug.

- [ ] **Step 2: Verify `more` has four items**

`/mini/more/page.tsx` lists: People, History (admin), Handbook, Settings (admin). No sub-section headings.

- [ ] **Step 3: Sweep for any leftover old paths**

```bash
grep -rn --include="*.ts" --include="*.tsx" -E "/mini/(charges|payments|spendings|deposits|members|guests|info)" src
```

Expected: empty.

- [ ] **Step 4: Sweep web side too**

```bash
grep -rn --include="*.ts" --include="*.tsx" -E "(href|push|redirect).*[\"'](/charges|/payments|/spendings|/deposits|/members|/guests|/info|/dashboard/history)" src
```

Expected: empty.

- [ ] **Step 5: Typecheck + tests + build**

```bash
pnpm typecheck && pnpm test && pnpm build
```

The `build` step is the strongest guarantee — Next.js will fail if a route is referenced but missing.

- [ ] **Step 6: Commit if any fixes were made**

If the sweeps surfaced stragglers and required edits:

```bash
git add -A
git commit -m "refactor(nav): mop up stragglers after rename"
```

If everything was clean, skip the commit.

---

## Task 8: Add 308 redirects and update README

**Final task: cushion bookmarked old URLs and update the smoke-check.**

**Files:**
- Modify: `next.config.mjs`
- Modify: `README.md` (smoke-check sequence)

### Steps

- [ ] **Step 1: Add the redirects block to `next.config.mjs`**

Replace the current `nextConfig` with:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'grammy'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  async redirects() {
    return [
      // Web
      { source: '/charges/:rest*',    destination: '/owed/:rest*',          permanent: true },
      { source: '/payments/:rest*',   destination: '/received/:rest*',      permanent: true },
      { source: '/deposits',          destination: '/received?tab=guests',  permanent: true },
      { source: '/spendings/:rest*',  destination: '/spent/:rest*',         permanent: true },
      { source: '/members/:rest*',    destination: '/people/:rest*',        permanent: true },
      { source: '/guests/deposits',   destination: '/received?tab=guests',  permanent: true },
      { source: '/guests',            destination: '/people?tab=guests',    permanent: true },
      { source: '/info',              destination: '/handbook',             permanent: true },
      { source: '/dashboard/history', destination: '/history',              permanent: true },
      // Mini
      { source: '/mini/charges/:rest*',    destination: '/mini/owed/:rest*',          permanent: true },
      { source: '/mini/payments/:rest*',   destination: '/mini/received/:rest*',      permanent: true },
      { source: '/mini/deposits',          destination: '/mini/received?tab=guests',  permanent: true },
      { source: '/mini/spendings/:rest*',  destination: '/mini/spent/:rest*',         permanent: true },
      { source: '/mini/members/:rest*',    destination: '/mini/people/:rest*',        permanent: true },
      { source: '/mini/guests/deposits',   destination: '/mini/received?tab=guests',  permanent: true },
      { source: '/mini/guests',            destination: '/mini/people?tab=guests',    permanent: true },
      { source: '/mini/info',              destination: '/mini/handbook',             permanent: true },
    ];
  },
};
export default nextConfig;
```

**Order matters within each group:** `/guests/deposits` is listed before `/guests` so the specific match wins. Same for the mini side.

- [ ] **Step 2: Smoke-test the redirects**

```bash
pnpm dev &
sleep 5
# In a separate shell or with curl:
curl -sI http://localhost:3000/charges | grep -i location
curl -sI http://localhost:3000/payments | grep -i location
curl -sI http://localhost:3000/deposits | grep -i location
curl -sI http://localhost:3000/spendings | grep -i location
curl -sI http://localhost:3000/members | grep -i location
curl -sI http://localhost:3000/guests | grep -i location
curl -sI http://localhost:3000/guests/deposits | grep -i location
curl -sI http://localhost:3000/info | grep -i location
curl -sI http://localhost:3000/dashboard/history | grep -i location
# Stop dev server
kill %1
```

Each should print a `location:` header pointing at the new path with HTTP 308.

- [ ] **Step 3: Update the README smoke-check**

In `README.md`, the "Smoke check" section currently references `/members`, `/charges`, `/payments/new`. Update to the new paths:

```markdown
## Smoke check

1. `pnpm dev`
2. As bootstrap admin: open `/`. You should be redirected to `/login` if no session.
3. Sign in with the Telegram widget.
4. Land on `/dashboard`. Verify pot balances render (both $0.00 on a fresh DB).
5. Navigate to `/people`, click "+ Invite", generate a link.
6. Test settings: change dues amount, click "Generate dues now". Charges should appear on `/owed` for every active member.
7. Record a payment for one of those charges via `/received/new`. Confirm the dashboard pot balance updates.
```

- [ ] **Step 4: Final typecheck + tests + build**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(nav): add 308 redirects from old URLs, update smoke check"
```

---

## Done

After Task 8, the Phase 1 navigation redesign is complete:

- Sidebar items: Dashboard, People, Owed, Received, Spent, History, Handbook, Settings (admin sees all eight; member sees seven without Settings).
- Mini bottom bar: Home, Owed, Received, Spent, More.
- Mini `More` page: People, History (admin), Handbook, Settings (admin).
- All old URLs redirect 308 to the new ones.
- Domain layer, DB, bot — untouched.

Phases 2 (unification of `(app)` and `(mini)`) and 3 (global "+ Record") get their own specs.
