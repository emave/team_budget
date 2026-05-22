# Guest deposits

## Problem

The team accepts money at activities from people who aren't team members — one-off walk-ins, recurring non-member friends, parents, etc. Today the only way to log this income is to either:

- create a fake member (pollutes the members list and the dues generator), or
- under-report income and patch the gap as a "spending adjustment".

Neither works. The current `payments` table is built around the invariant *"a payment is a known member paying their charges"*: `payerUserId` is `NOT NULL` and the payment must fully allocate to charges that belong to that member. Guest income breaks both rules.

A secondary need surfaced during brainstorming: when the same guest pays repeatedly (e.g. "Pasha" comes most Saturdays), their deposits should accrue against a single identity so per-guest history is queryable. A free-form name string on each deposit row would not give that.

## Scope

In:
- A `guests` entity (named, archivable) so repeat guests aggregate cleanly.
- A `guest_deposits` ledger, optionally linked to a `guests` row (NULL = anonymous one-off).
- Admin-only entry points: web form, Mini App quick action, Telegram bot conversation.
- `/guests` roster page (totals, last seen, rename, archive).
- `/guests/deposits` time-table view (rows = date, columns = guests, cells = sum).
- Fold guest deposits into pot balances, money movements, and Mini App recent activity so the dashboard reflects reality.

Out (deliberately deferred):
- A separate aliases table (one guest, many display names). YAGNI until it bites.
- A guest-merge tool in the UI. Manual SQL for now.
- Guest login / Telegram link. Guests intentionally have no accounts.
- Charges, dues, debt tracking for guests.
- Auto-matching by phone/email/photo.
- Per-guest detail page with a full history view. The `/guests/deposits` matrix covers v1.

## Design

### Schema

`src/server/db/schema.ts` — two new tables:

```ts
export const guests = sqliteTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const guestDeposits = sqliteTable('guest_deposits', {
  id: text('id').primaryKey(),
  guestId: text('guest_id').references(() => guests.id),
  amount: integer('amount').notNull(),
  method: text('method', { enum: ['cash', 'card'] }).notNull(),
  note: text('note'),
  receivedAt: text('received_at').notNull(),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});
```

New Drizzle migration `drizzle/0004_*.sql` creates both tables. Existing data is untouched; the migration is purely additive.

Indexes:
- `guest_deposits(guest_id)` — per-guest history queries.
- `guest_deposits(received_at)` — date-range matrix queries.

Rationale for two tables (vs. a single `guest_deposits` with a `payerName` text column):
- Rename a guest once, history updates everywhere (join on `id`, not on a name string).
- `guestId` is a stable identity for the "same person again" case without needing fuzzy matching.
- Anonymous one-offs remain trivial via `guestId = NULL`.
- Archiving preserves history; FK protects against accidental orphaning.

### Domain layer

`src/server/domain/guests.ts` (new):
- `createGuest(db, { name, createdByUserId })` — trims name, rejects empty.
- `listGuests(db, { includeArchived?: boolean })` — for typeahead and roster.
- `getGuest(db, id)`.
- `renameGuest(db, id, name)` — trims, rejects empty.
- `archiveGuest(db, id)` / `unarchiveGuest(db, id)` — idempotent flag flip.

`src/server/domain/guest-deposits.ts` (new):
- `recordGuestDeposit(db, { guestId?, amount, method, note?, receivedAt?, createdByUserId })`
  - Asserts `amount` is a positive integer (cents).
  - Validates `method ∈ {cash, card}`.
  - If `guestId` provided, validates the guest exists and is not archived.
  - `receivedAt` defaults to `new Date().toISOString()` if absent.
  - Inserts; no charges, no allocations.
- `cancelGuestDeposit(db, id)` — soft-cancel via `cancelledAt = now`; idempotent.
- `listGuestDeposits(db, { range?, limit?, guestId? })` — used by `/guests/deposits`, `/guests` roster aggregates, and Mini App.
- `sumGuestDepositsByMethod(db, method)` — used by `getPotBalances`.
- `guestDepositSummary(db, { from, to })` — returns rows shaped as
  ```
  { date: 'YYYY-MM-DD', guestId: string | null, amount: number }[]
  ```
  with cancelled rows excluded. The matrix view pivots this client-side (small dataset; pivoting in SQL is not worth the complexity).

Tests in `tests/domain/guests.test.ts` and `tests/domain/guest-deposits.test.ts` cover create/rename/archive, record/cancel, summary aggregation under range filters, and that cancelled deposits do not affect sums.

### Read paths that change

Three places fold guest deposits into existing aggregates:

| File | Change |
|---|---|
| [src/server/domain/pots.ts](../../../src/server/domain/pots.ts) | Add `sumGuestDepositsByMethod('cash')` and `('card')` to the `Promise.all`; add `cashGuest` and `cardGuest` into the `cash`/`card` balance equations. |
| [src/server/domain/movements.ts](../../../src/server/domain/movements.ts) | Add `kind: 'guest_deposit'` variant carrying `id`, `at`, `amount`, `method`, `guestId \| null`, `guestName \| null`, `note`. Existing inner-join with `users` for member payments is preserved; guest deposits join `guests` via LEFT JOIN. |
| [src/server/domain/activity.ts](../../../src/server/domain/activity.ts) | Add `kind: 'guest_deposit'` to `ActivityEvent` so the Mini App home recent-activity list shows guest deposits inline. |

The existing `/payments` page and `payments-table.tsx` remain **member-only** — guest deposits live under `/guests/deposits`. Mixing them in one table would conflict with the matrix layout below and confuse the per-member charge accounting that powers the existing list.

### UI — admin web

**New: `/guests` (roster).** Server component, admin-only.

Table columns:
- Name
- Lifetime deposited (sum of non-cancelled `guest_deposits.amount`)
- Deposit count
- Last deposit date
- Actions: Rename (modal), Archive / Unarchive

A "+ New guest" button opens a modal with a single name input. Archived guests collapse under a "Show archived" toggle.

**New: `/guests/deposits` (time-table).** Server component, admin-only.

- Date range filter (reuses the existing range component used by the dashboard).
- Default range: last 90 days.
- Rendered as a table:
  - Rows: one per calendar date in the range that had at least one deposit (desc by date).
  - Columns: one per non-archived guest that has any deposit in the range, plus a final "Anonymous" column for `guestId = NULL` deposits, plus a "Day total" column.
  - Cells: sum of that guest's non-cancelled deposits on that date. Blank if zero.
  - Footer row: per-guest totals.
- For an admin with many archived guests: archived guests appear in the matrix only if they have a deposit in the visible range, and are visually marked.

If the matrix grows wide (many guests in range), the table scrolls horizontally — same pattern already used elsewhere in the project.

**Updated: `/payments/new`.** A "Member payment | Guest deposit" toggle at the top. Guest branch hides the allocations UI and shows:
- Guest typeahead (existing non-archived guests + a "+ Create '<typed name>'" option when no exact match).
- Amount.
- Method (cash/card).
- Note (optional).
- Received-at date input, defaulting to today.

Submitting calls `recordGuestDeposit` and routes to `/guests/deposits`.

### UI — Mini App

A new admin-only "+ Guest deposit" button on `/mini/payments`. Tapping opens a sheet/page with the same form (typeahead, amount, method, note, date). Submitting returns to the payments list.

`/mini` home recent activity already groups by event kind; the new `guest_deposit` variant from `activity.ts` renders as a deposit row with the guest name (or "Guest" for anonymous) and the method.

### Bot — `/guestdeposit` conversation

New admin command, registered alongside the other admin commands in `src/server/bot/admin-commands.ts`. Conversation flow in `src/server/bot/conversations/guest-deposit.ts`:

1. **Amount** — parsed via the existing money parser.
2. **Method** — inline keyboard: Cash / Card.
3. **Guest** — inline keyboard listing up to 8 non-archived guests ordered by most recent non-cancelled deposit (`MAX(receivedAt)`, NULLs last), plus "+ New", plus "Anonymous", plus "Cancel".
4. **If "+ New"** — ask for name (text). Creates the guest immediately.
5. **Note** — text or `/skip`.
6. **Confirm** — summary message with Confirm / Cancel buttons.

On confirm, calls `recordGuestDeposit` with the creating admin's `userId` as `createdByUserId`. Localized in `src/server/bot/i18n.ts` for en/ru.

### Server actions

`src/server/actions/guests-server.ts` and `guests.ts`:
- `createGuest`, `listGuests`, `renameGuest`, `archiveGuest`, `unarchiveGuest`.

`src/server/actions/guest-deposits-server.ts` and `guest-deposits.ts`:
- `recordGuestDeposit`, `cancelGuestDeposit`, `listGuestDeposits`, `guestDepositSummary`.

All wrapped via the existing `_wrapper.ts` admin-gate pattern. No member-level actions exist for these endpoints in v1.

### i18n

New keys under `m.guests.*` and `m.guestDeposits.*` for en and ru: page titles, table headers, form labels, buttons, bot prompts, confirmations, error messages. Follow the existing nested-namespace convention in `src/shared/i18n/`.

### Tests

- `tests/domain/guests.test.ts` — create / rename / archive / list filters.
- `tests/domain/guest-deposits.test.ts` — record (with and without guest), reject negative/zero, cancel idempotent, sum excludes cancelled, summary groups by date+guest.
- `tests/domain/pots.test.ts` — extend to assert pot balance includes guest deposits and excludes cancelled ones.
- `tests/domain/movements.test.ts` — extend to assert `guest_deposit` events appear with correct name resolution (including anonymous).

No bot/UI e2e tests in v1; the domain layer is where the invariants live.

## Migration & rollout

- Drizzle migration `0004_*.sql` is additive (CREATE TABLE only). Existing DB unaffected. Migration runs idempotently on container start per the existing entrypoint.
- No data backfill: there is no prior "guest" data to import.
- No feature flag: deployment ships the feature live; behaviour for the existing member-payment flow is unchanged.

## Open questions

None blocking. Future iterations may add: per-guest detail page with full history, alias support, guest-merge UI, contact info fields on guest records.
