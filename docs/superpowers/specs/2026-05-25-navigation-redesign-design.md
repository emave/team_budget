# Navigation redesign — money-flow IA

Date: 2026-05-25
Status: Design — implementation plan to follow.

## Problem

The current information architecture has accumulated nine top-level routes (`/dashboard`, `/members`, `/charges`, `/payments`, `/spendings`, `/info`, `/guests`, `/deposits`, `/settings`) on the web sidebar, with the mini app's bottom-tab shell already overflowing into a five-item "More" page. The naming is domain-noun heavy and partially overlapping:

- `Deposits` is a superset of `Payments` (it adds guest deposits) — the two compete for the same mental slot.
- `Guests` is a separate top-level page despite functionally being "non-member people who pay in".
- `Spendings` is not standard English.
- High-frequency admin actions (record payment, record spending, charge dues) are buried one click into separate pages.
- A member's self-view is reachable only via the members list.

The two route trees (`src/app/(app)/*` for the web sidebar app, `src/app/(mini)/*` for the Telegram Mini App) duplicate the same domain pages with different component vocabularies, doubling maintenance.

## Scope

This spec covers **Phase 1: information architecture and vocabulary**. It is the first of three sequenced phases agreed during brainstorming:

1. **Phase 1 (this spec):** rename and regroup the top-level routes, merge two pairs of pages.
2. **Phase 2 (deferred):** collapse `(app)` and `(mini)` into one responsive route tree.
3. **Phase 3 (deferred):** global "+ Record" action surface (FAB on mobile, menu on desktop).

Phases 2 and 3 get their own specs. Phase 1 is deliberately surgical: it does not touch the domain layer, the database schema, or the bot's command vocabulary.

## Goals

- Reduce the top-level navigation from 9 admin items / 6 member items to 8 / 7.
- Replace overlapping nouns with a money-flow vocabulary that reads like a sentence: *who is **Owed**, what was **Received**, what was **Spent**, what's the full **History***.
- Collapse the `Payments` / `Deposits` duplication and the `Members` / `Guests` separation into single pages with tabs.
- Promote `History` from a buried dashboard sub-route to a first-class destination.
- Leave the domain, DB, and bot untouched.

## Non-goals

- No unification of the two route trees (Phase 2).
- No global record-action surface (Phase 3).
- No `/me` shortcut. (Future addition when self-view becomes a felt need.)
- No splitting of `Settings` (it stays as a three-section page: dues, pot openings, categories).
- No changes to the bot's commands, callback data, or strings. The bot is a separate UX with its own vocabulary.
- No DB schema changes. Tables stay `charges`, `payments`, `spendings`, `deposits`, `guests`.

## Top-level navigation (Phase 1 outcome)

In display order:

| Position | Label | Replaces | Visible to | Notes |
|---|---|---|---|---|
| 1 | **Dashboard** | Dashboard | Everyone | Content unchanged. |
| 2 | **People** | Members + Guests | Everyone (Guests sub-tab admin-only) | Tabs: Members / Guests / Pending invites (admin). |
| 3 | **Owed** | Charges | Everyone | Open debts, status filter unchanged. |
| 4 | **Received** | Payments + Deposits | Everyone | Tabs: All / From members / From guests. Date range + person filter. |
| 5 | **Spent** | Spendings | Everyone | Category column unchanged. |
| 6 | **History** | dashboard/history + mini/history | Admin | Promoted from sub-route to top-level. |
| 7 | **Handbook** | Info | Everyone (admin edits) | Read-only wiki pages. |
| 8 | **Settings** | Settings | Admin | Dues + pot openings + categories (unchanged). |

Sidebar stays flat (no MONEY/PEOPLE/ADMIN section headers). At eight items, grouping costs more than it earns.

## Mini app shell

The mini app keeps the bottom-tab pattern (it's the native Telegram feel). The five tabs become:

```
Dashboard · Owed · Received · Spent · More
```

The four money tabs cover ≥90% of taps for both roles. `People` drops off the bar — it's a navigational jumping-off point, not a hot tab — and becomes the first item inside *More*.

The new *More* page lists four items with no sub-sections (the current page has 5–6 items behind three sub-sections — `Activity` / `Admin` / `Team` — which is the smell that today's More is a junk drawer):

- **People** — Members + Guests with sub-tabs.
- **History** — admin only.
- **Handbook**.
- **Settings** — admin only.

A people-leaning variant (`Dashboard · People · Owed · Received · More`) was considered and rejected: it demotes `Spent`, which admins record several times per game day.

## Page-level merges

### People (`/people`, `/mini/people`)

Replaces `/members` and `/guests`. Single page, sub-tabs at the top.

```
PEOPLE
[ Members ] [ Guests ]            ← Guests tab admin-only
─────────────────────────────────
<MembersTable>                     ← unchanged: name, role badge, debt/credit
<PendingInvitesTable>              ← admin only
[ Invite ]                         ← admin only
```

- `/people/[id]` carries the existing member detail page (was `/members/[id]`).
- The Guests tab carries the existing guest table (totals / count / last deposit), the archived toggle, and the new-guest button.
- No guest detail page (none today either).

### Received (`/received`, `/mini/received`)

Replaces `/payments` and `/deposits`. The current `/deposits` page already does this merge well — it just gets renamed, promoted to the primary route, and absorbs `/payments`.

```
RECEIVED
[ All ] [ From members ] [ From guests ]    + date range + person filter
─────────────────────────────────────────
<chronological feed of payments + guest deposits>
[ + Record ]                       ← admin only; chooser: from member / from guest
```

Member visibility stays as it is today: members see all team payments (the current `/payments` exposes them). Cancel actions remain in-row, admin-only.

### History (`/history`, `/mini/history`)

Promoted from `/dashboard/history` to top-level. Same content (full chronological ledger of money movements). The dashboard's "view history" link is preserved for discoverability but the route is now first-class. Admin only.

### Pure renames (no shape change)

- `/charges`, `/charges/new` → `/owed`, `/owed/new`.
- `/spendings`, `/spendings/new` → `/spent`, `/spent/new`. Categories stay in Settings.
- `/info` → `/handbook`.
- `/dashboard`, `/settings`, `/login` stay where they are.

## Migration plan

### Principle: rename the interaction surface, not the data layer

| Layer | Rename? | Reason |
|---|---|---|
| URLs | ✅ | User-facing. |
| Nav labels & page headings | ✅ | User-facing. |
| i18n keys (`m.charges.*` → `m.owed.*`) | ✅ | Stay coherent with values. |
| React components (`ChargesTable` → `OwedTable`, etc.) | ✅ | Reduce vocabulary drift. |
| `src/server/domain/charges.ts`, `domain/spendings.ts`, … | ❌ | Domain reflects data, not UI. |
| DB tables (`charges`, `payments`, `spendings`, `deposits`, `guests`) | ❌ | Schema migrations are expensive and add no clarity. |
| Bot commands & strings | ❌ | Bot is a separate UX. |

The rename touches roughly 30–40 files in `src/app/` and `src/ui/`, plus the EN/RU bundles in `src/shared/i18n/`. No Drizzle migration, no domain churn.

### URL map

| Old (web) | Old (mini) | New (web) | New (mini) |
|---|---|---|---|
| `/charges`, `/charges/new` | `/mini/charges`, `…/new` | `/owed`, `/owed/new` | `/mini/owed`, `…/new` |
| `/payments`, `/payments/new` | `/mini/payments`, `…/new`, `…/guest` | `/received`, `/received/new` | `/mini/received`, `…/new`, `…/guest` |
| `/deposits` | `/mini/deposits` | `/received?tab=guests` | `/mini/received?tab=guests` |
| `/spendings`, `/spendings/new` | `/mini/spendings`, `…/new` | `/spent`, `/spent/new` | `/mini/spent`, `…/new` |
| `/members`, `/members/[id]` | `/mini/members`, `…/[id]`, `…/invite` | `/people`, `/people/[id]` | `/mini/people`, `…/[id]`, `…/invite` |
| `/guests` | `/mini/guests` | `/people?tab=guests` | `/mini/people?tab=guests` |
| `/guests/deposits` | `/mini/guests/deposits` (already redirects today) | `/received?tab=guests` | `/mini/received?tab=guests` |
| `/info` | `/mini/info` | `/handbook` | `/mini/handbook` |
| `/dashboard/history` | `/mini/history` | `/history` | `/mini/history` |
| `/dashboard`, `/settings`, `/login`, `/mini` | — | unchanged | unchanged |

### Redirects

Keep old paths alive for one release cycle as **308 permanent redirects** in `next.config.mjs`:

```js
async redirects() {
  return [
    { source: '/charges/:rest*',   destination: '/owed/:rest*',   permanent: true },
    { source: '/payments/:rest*',  destination: '/received/:rest*', permanent: true },
    { source: '/deposits',         destination: '/received?tab=guests', permanent: true },
    { source: '/spendings/:rest*', destination: '/spent/:rest*',  permanent: true },
    { source: '/members/:rest*',   destination: '/people/:rest*', permanent: true },
    { source: '/guests/deposits',  destination: '/received?tab=guests', permanent: true },
    { source: '/guests',           destination: '/people?tab=guests',   permanent: true },
    { source: '/info',             destination: '/handbook',      permanent: true },
    { source: '/dashboard/history', destination: '/history',      permanent: true },
    // mini equivalents
    { source: '/mini/charges/:rest*',   destination: '/mini/owed/:rest*',   permanent: true },
    { source: '/mini/payments/:rest*',  destination: '/mini/received/:rest*', permanent: true },
    { source: '/mini/deposits',         destination: '/mini/received?tab=guests', permanent: true },
    { source: '/mini/spendings/:rest*', destination: '/mini/spent/:rest*',  permanent: true },
    { source: '/mini/members/:rest*',   destination: '/mini/people/:rest*', permanent: true },
    { source: '/mini/guests/deposits',  destination: '/mini/received?tab=guests', permanent: true },
    { source: '/mini/guests',           destination: '/mini/people?tab=guests',   permanent: true },
    { source: '/mini/info',             destination: '/mini/handbook',      permanent: true },
  ];
}
```

Covers bookmarks and any in-flight Telegram chat links. Removable after one sprint.

### i18n key restructure

- `m.nav.{charges,payments,spendings,deposits,guests,info}` → `m.nav.{owed,received,spent,people,handbook}` (Deposits and Guests disappear).
- Namespace rename in EN + RU bundles:
  - `m.charges.*` → `m.owed.*`
  - `m.payments.*` and `m.deposits.*` → `m.received.*` (merged)
  - `m.spendings.*` → `m.spent.*`
  - `m.members.*` and `m.guests.*` → `m.people.*` (merged)
  - `m.info.*` → `m.handbook.*`
- Untouched: `m.bot.*`, `m.wallet.*`, `m.mini.*`, `m.dashboard.*`, `m.settings.*`, `m.common.*`.
- New RU labels: Owed → «Долги», Received → «Поступления», Spent → «Расходы», People → «Люди», Handbook → «Справка», History → «История».

### Blast radius checklist

The implementation plan must verify each:

- Mini app entry `/mini` still resolves to the same dashboard component (BotFather points at this URL — unchanged).
- Telegram Login Widget callback `/api/auth/telegram/callback` redirect target uses `/dashboard` (already does).
- `auth-middleware` `PUBLIC_PATHS` is unaffected (it allows `/api/bot/webhook`, `/login`, statics).
- Every `Link href` / `LinkButton href` / `router.push` / `redirect()` call in `src/app/` is updated. The greps in `(app)/` and `(mini)/` (run during brainstorming) found 30-ish call sites — mechanical to update.
- E2E and component tests that hit old URLs are updated.
- README smoke-check sequence is updated to use new URLs.

## Affected components (rename map)

The components below are renamed alongside their routes. Internal logic unchanged.

| Old | New |
|---|---|
| `src/app/(app)/charges/*`, `src/app/(mini)/mini/charges/*` | `…/owed/*`, `…/mini/owed/*` |
| `src/app/(app)/payments/*` + `src/app/(app)/deposits/*` | `…/received/*` (deposits folder absorbed) |
| `src/app/(mini)/mini/payments/*` + `…/mini/deposits/*` | `…/mini/received/*` |
| `src/app/(app)/spendings/*`, `src/app/(mini)/mini/spendings/*` | `…/spent/*`, `…/mini/spent/*` |
| `src/app/(app)/members/*` + `src/app/(app)/guests/*` | `…/people/*` (guests folder absorbed) |
| `src/app/(mini)/mini/members/*` + `…/mini/guests/*` | `…/mini/people/*` |
| `src/app/(app)/info/*`, `src/app/(mini)/mini/info/*` | `…/handbook/*`, `…/mini/handbook/*` |
| `src/app/(app)/dashboard/history/*` | `src/app/(app)/history/*` |
| `ChargesTable` | `OwedTable` |
| `PaymentsTable` + `DepositsView` | `ReceivedTable` (one component) |
| `SpendingsTable` | `SpentTable` |
| `GuestsTable` | merged into `PeopleTable` (or kept as `GuestsTable` rendered inside the Guests tab — implementation detail for the plan) |
| `app-shell.tsx` nav items array | new labels & hrefs |
| `mini/tabs.tsx` tab array | new five tabs |
| `mini/more/page.tsx` | new four items, no sub-sections |

## What stays exactly the same

- Domain modules in `src/server/domain/`.
- DB schema and Drizzle migrations.
- Bot conversations, commands, callback strings, and bot menu (recent work in `feat(bot): single-balance model + expanded menu`).
- All business logic (charge generation, payment allocation, credit/wallet, money movements).
- All cron jobs and instrumentation.
- The `/api/*` surface.

## Risks

- **Telegram chat history holds links to old URLs.** Mitigated by 308 redirects for one sprint.
- **Muscle memory disruption for the existing admin (the user himself).** Acceptable cost for the clearer mental model; bot vocabulary is unchanged so day-to-day chat flow is unaffected.
- **i18n key sweep is the biggest source of mistakes.** Mitigated by doing it as a single mechanical pass and running typecheck — the i18n bundle is typed.
- **Two sources of truth (web tree + mini tree) make the rename happen twice.** Acceptable for Phase 1; Phase 2 will collapse the duplication.

## Sequencing into Phase 2 and Phase 3

Phase 1 deliberately chooses URLs and labels that are stable under Phase 2's unification: the future single route tree will use exactly these names. Phase 1 also leaves headroom in the mini bottom bar for Phase 3's "+ Record" action (which will likely become a centre-FAB between Received and Spent, in the native Telegram pattern).
