# Dashboard Money-Flow Timesheet

## Problem

The admin dashboard has a `<ActivityFeed>` showing the 10 most recent events — a mixed list of charges (debt assignments), payments (deposits), and spendings (withdrawals). It answers "what happened recently" but not "who put money in / what was spent, when, over a period". The team needs a money-flow history view: who deposited, what was withdrawn, when, over a chosen time window.

## Goal

Replace the existing activity feed on the admin dashboard with a Tempo-style timesheet grid showing deposits and withdrawals as event cards placed on a per-day, per-lane grid. The non-admin (member) view of the dashboard is unchanged.

## Scope

**In scope (v1):**
- New money-flow grid replacing the activity feed.
- Date range filter via URL query (`?from=…&to=…`), default = current calendar month (1st → today).
- Per-member lanes for deposits + two pot lanes (`Cash`, `Card`) for withdrawals.
- Cards inside cells; multiple cards same day same lane stack vertically.
- Sticky lane labels (left) and date header (top) on scroll.
- Range clamped to 90 days; clamp visible to the user.
- Cancelled payments and spendings excluded.

**Out of scope (v1):**
- Mobile fallback list view (the grid horizontally scrolls; truly small viewports may be unusable — flagged, not built).
- Clicking a card to edit/cancel.
- Showing charges in the grid.
- CSV / report export.
- Server-side pagination (range cap of 90 days makes this unnecessary).

## User-visible behavior

### Lanes (rows), top to bottom

1. **Member lanes** — one per member who has at least one non-cancelled deposit (`payments` row) in the selected range. Sorted by total deposit volume in the range, descending. Members with no activity in the range are hidden.
2. **Divider** between member lanes and pot lanes.
3. **Pot lanes** — `Cash` and `Card`, always shown (even with no withdrawals in the range). Styled with a pot badge so they read distinctly from member rows.

### Columns

One column per calendar day from `from` to `to`, inclusive. Header shows day-of-month with weekday (e.g. `Mon 20`). Weekends are visually muted. Today's column is highlighted.

### Cells

Empty by default. When events occurred, the cell stacks small **event cards** vertically.

Each card shows:
- Signed amount with currency suffix, e.g. `+50.00 BYN` (deposits) or `−120.00 BYN` (withdrawals). Withdrawal cards are colored red.
- A tiny method/pot icon or letter (`C` for cash, `K` for card — exact glyph TBD during build; tooltip carries the full label).
- Tooltip on hover/tap exposes the deposit `note` or spending `description`. Empty notes show nothing.

### Date range picker

- BaseWeb `DatePicker` in `range` mode.
- Defaults: 1st of the current calendar month (server local TZ) → today.
- Picker change pushes new `?from=YYYY-MM-DD&to=YYYY-MM-DD`; server re-renders.
- Range capped at 90 days. If the requested range is wider, narrow `from` to `to − 89 days` and show a muted notice ("Range narrowed to last 90 days.") above the grid.

### Empty state

When no movements fall in the range, render a muted "Nothing in this period." centered in the grid area. Lane structure (member rows hidden; pot rows shown) still respects the rules above, so an empty range collapses to just the two pot rows with no cards.

### Sticky behavior

- Left column (lane label) sticks during horizontal scroll.
- Date header row sticks during vertical scroll.

## Architecture

### Files touched

- **New:** `src/server/domain/movements.ts` — domain function `listMoneyMovements`.
- **Modified:** `src/app/(app)/dashboard/page.tsx` — read `searchParams`, call new domain function, render new client component.
- **New:** `src/app/(app)/dashboard/money-history.tsx` — client component: range picker + grid + cells + cards.
- **Modified:** `src/app/(app)/dashboard/activity.tsx` — deleted if no other consumer; the file referenced only `recentActivity` and `ActivityFeed`, both replaced.
- **Modified:** `src/server/domain/activity.ts` — `recentActivity` removed if `page.tsx` is its only caller.
- **Modified:** `src/server/i18n` locale files — new keys (see below).

### Server: `listMoneyMovements`

```ts
export type Movement =
  | { kind: 'deposit'; id: string; at: string; amount: number;
      method: 'cash' | 'card'; payerUserId: string; payerDisplayName: string;
      note: string | null }
  | { kind: 'withdraw'; id: string; at: string; amount: number;
      pot: 'cash' | 'card'; description: string };

// `amount` is always a non-negative integer in cents (as stored in DB).
// The +/− sign and color are added at render time based on `kind`.

export async function listMoneyMovements(
  db: Db,
  range: { from: string; to: string }, // YYYY-MM-DD inclusive
): Promise<Movement[]>;
```

Query rules:
- **Payments:** `receivedAt >= from AND receivedAt <= to || ' 23:59:59' AND cancelledAt IS NULL`. Join `users` to obtain `payerDisplayName`.
- **Spendings:** `occurredAt >= from AND occurredAt <= to || ' 23:59:59' AND cancelledAt IS NULL`.
- Merge both, sort by `at` desc, then `id` desc for stability.

`at` is the business date (`receivedAt` / `occurredAt`), not `createdAt`. This is the date that matters for "when the money moved" reconciliation.

### Page wiring

`page.tsx` (admin branch only) gains:

```ts
export default async function DashboardPage({
  searchParams,
}: { searchParams: { from?: string; to?: string } }) {
  // ... resolve range with defaults + 90-day clamp ...
  // ... call listMoneyMovements(db, range) ...
  // ... pass { movements, range, clamped } to <MoneyHistory /> ...
}
```

(Next 14 — `searchParams` is sync; matches the existing pattern in `src/app/(app)/charges/page.tsx`.)

Range resolution:
1. Parse `from`/`to` against a strict `YYYY-MM-DD` regex via Zod. Invalid or missing → use defaults.
2. Default `from` = first day of current calendar month (server local TZ). Default `to` = today.
3. If `to < from`, swap.
4. If `to - from > 89 days`, set `from = to - 89 days` and `clamped = true`.

### Client: `<MoneyHistory>`

Receives `{ movements, range, clamped }`. The component:

1. Computes day axis: `eachDayBetween(range.from, range.to)`.
2. Computes member lanes: distinct `payerUserId`s from `movements` of kind `deposit`, sorted by sum of deposit `amount` desc. Stores `{ id, displayName }` pairs.
3. Pot lanes are static: `[{ key: 'pot:cash', label: m.dashboard.laneCashPot }, { key: 'pot:card', label: m.dashboard.laneCardPot }]`.
4. Builds cell index: `Map<laneKey + '|' + day, Movement[]>`. `laneKey` is `member:<id>` or `pot:<cash|card>`.
5. Renders:
   - Header bar: `m.dashboard.movementsHeading` + `<DateRangePicker>` + (if `clamped`) clamp notice.
   - Grid: CSS Grid with `grid-template-columns: [lane-label] auto [days] repeat(N, minmax(60px, 1fr));` — or a horizontally-scrollable wrapper if N > some threshold. Exact threshold TBD during build (keep the grid playable on a 1280px viewport for ~31 days).
   - Sticky behavior via `position: sticky` on the first column (`left: 0`) and the header row (`top: 0`).
6. Cell rendering: looks up `Movement[]` in the cell index, renders a vertical stack of BaseWeb `Tag`-style chips. Withdrawal chips have a red theme; deposit chips have a neutral/positive theme.
7. Tooltips: BaseWeb `StatefulTooltip` on each card showing `note` or `description`.

### i18n keys (added to all locale files)

- `dashboard.movementsHeading` — "Money flow" / "Движение средств" / "Грошавы рух"
- `dashboard.noMovements` — "Nothing in this period."
- `dashboard.rangeClamped(maxDays)` — "Range narrowed to last {n} days."
- `dashboard.laneCashPot` — "Cash"
- `dashboard.laneCardPot` — "Card"

Existing `dashboard.activityHeading`, `dashboard.colEvent`, `dashboard.colWhen`, `dashboard.noActivity`, `dashboard.chargeLine`, `dashboard.paymentLine`, `dashboard.spendingLine` become unused; remove during build.

## Data assumptions

- `payments.receivedAt` and `spendings.occurredAt` are stored as ISO strings (or `YYYY-MM-DD HH:MM:SS`) consistent enough for lexicographic comparison. (Verify during implementation; if not, normalize via SQL `date(...)` extraction.)
- `payments.cancelledAt` and `spendings.cancelledAt` exist and are `NULL` for active rows.
- Lower limit: deposits and withdrawals are not expected to exceed a few hundred rows over 90 days for this team; no pagination needed.

## Testing

- **Unit:** `listMoneyMovements` — range filter (inclusive boundaries), cancelled exclusion, sort order, empty result.
- **Component (light):** `<MoneyHistory>` rendering with empty data, with a single deposit, with a single withdrawal, with multiple events same day same lane (stack), and with `clamped = true` (clamp notice renders).
- **No new E2E.**

## Risks / open items

1. **Glyph for method/pot on cards** — `C` / `K` is a placeholder; pick a final glyph or BaseWeb icon during the UI pass.
2. **Date string format consistency** — if `receivedAt` / `occurredAt` shapes vary across rows, the lexicographic range filter could be wrong; verify during build and switch to `date(column)` if needed.
3. **Mobile** — the grid scrolls horizontally inside the panel, but on very narrow viewports the experience is poor. Acceptable for v1; a list-mode fallback can be added later.
4. **TZ** — "current calendar month" uses the server local TZ. The TrueNAS host's TZ is the source of truth. Acceptable since this is single-team self-hosted.
