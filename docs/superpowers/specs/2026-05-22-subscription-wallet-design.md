# Subscription wallet (member credit / overpayment)

## Problem

Today every payment must fully allocate to a member's open charges ([§3.6 of the v1 spec](2026-05-19-team-budget-design.md#L66-L74), enforced in [src/server/domain/payments.ts](../../../src/server/domain/payments.ts#L43-L51)). Members can't prepay — there is no way to hand the team $50 to cover the next five months of dues. Overpaying is rejected.

We want members to be able to **hand over more money than they currently owe and let the surplus sit until future charges arrive**. The surplus auto-applies to upcoming monthly dues; admins can manually apply it to other charge types, refund it, or transfer it between members.

The original v1 spec explicitly punted this to a later iteration ([§13: "Floating credit / overpayments"](2026-05-19-team-budget-design.md#L472)). This document is that iteration.

## Scope

In:
- Loosen the payment-allocation invariant: a payment row can be partially or zero allocated; the unallocated remainder is the payer's credit.
- A new `credit_movements` table for refunds and member-to-member transfers (events the payments table can't represent).
- Auto-apply credit (FIFO) to newly-created monthly dues charges during `generateMonthlyDues`.
- Manual-apply credit to non-dues charges via an admin action on the charge.
- Surface credit balances on the member dashboard, mini-app home, members roster, and per-member detail page.
- A "Members' prepaid credit (liability)" line on the admin team dashboard.
- Bot conversations: `/wallet` for members, `/deposit` and `/refund` for admins.
- Notifications when credit is deposited, applied to dues, refunded, or transferred.
- Wipe existing test money data as part of the rollout migration.

Out (deliberately deferred):
- A dedicated `/credits` top-level admin page. All credit management lives inside `/members/[id]` and the existing `/payments/new` flow.
- Auto-apply credit to non-dues charges (`adhoc`, `out_of_bounds`, `pot_borrow`). Manual-only by design — these are admin-initiated and unpredictable.
- Transfer-credit and manual-apply via the bot. Admin-rare; web/mini covers it.
- Interest, time-decay, or expiry on credit.
- Multi-currency.
- Member-initiated deposits without an admin recording them.

## Concept and terminology

A **credit** is money a member has handed over that isn't yet tied to any specific charge. It hits the team pot immediately (the money physically arrived) but is earmarked for that member's future obligations.

User-facing name: **"Subscription wallet"** (EN), **"Кошелёк"** (RU). The dashboard widget reads "Subscription wallet: $30.00".

Code-facing name: `credit`, `creditBalance`, `credit_movements`.

Behaviour summary:
- **Auto-applies** (FIFO, oldest credit first) to `monthly_dues` charges as they are generated.
- **Manually applies** to `adhoc`, `out_of_bounds`, `pot_borrow` charges via an admin action on the charge.
- Admin actions: **deposit** (standalone, no allocations), **refund** (pot ↓, credit ↓), **transfer** (member A credit ↓, member B credit ↑), **cancel** any of the above.
- Deactivating a member with positive credit shows a confirmation dialog ("This member has $X credit. Deactivate anyway?"). Credit persists across deactivation.

## Design

### Schema

One new table, one loosened invariant, no other column changes.

#### Loosen the allocation invariant

Today: `Σ(allocations.amount) for a payment = payment.amount`.
New: `Σ(allocations.amount) for a payment ≤ payment.amount`.

The unallocated remainder of a non-cancelled payment is that payment's contribution to the payer's credit balance. The full `amount` already hits the pot via the existing pot equation — no change there. `payment_allocations` rows themselves are unchanged.

#### New table `credit_movements`

For events the payments table can't represent: refunds (money out of pot, credit down) and transfers between members (credit moves, pot unchanged).

```ts
export const creditMovements = sqliteTable('credit_movements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['refund', 'transfer_in', 'transfer_out'] }).notNull(),
  amount: integer('amount').notNull(),                                  // always positive
  method: text('method', { enum: ['cash', 'card'] }),                   // refund only; NULL for transfers
  counterpartyUserId: text('counterparty_user_id').references(() => users.id),  // transfers; NULL for refunds
  groupId: text('group_id'),                                            // pairs transfer_in/out
  note: text('note'),
  occurredAt: text('occurred_at').notNull(),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});
```

A refund inserts one row (`kind='refund'`, `amount=X`, `method='cash'|'card'`).
A transfer inserts two rows sharing a `groupId`: `(A, transfer_out, X)` and `(B, transfer_in, X)` with each row's `counterpartyUserId` pointing at the other side.

Indexes:
- `credit_movements(user_id)` — per-member balance queries.
- `credit_movements(kind, cancelled_at)` — pot-balance refund sum.
- `credit_movements(group_id)` — paired-cancel lookup.

#### Derived balances

**Member credit balance** (non-cancelled rows only, in cents):

```
creditBalance(m) =
    Σ (p.amount − Σ allocations.amount for p)   over payments p where payerUserId=m, cancelledAt IS NULL
  + Σ cm.amount  for cm.kind='transfer_in'      where userId=m, cancelledAt IS NULL
  − Σ cm.amount  for cm.kind='transfer_out'     where userId=m, cancelledAt IS NULL
  − Σ cm.amount  for cm.kind='refund'           where userId=m, cancelledAt IS NULL
```

**Pot balance** — one new subtractive term added to [`pots.ts`](../../../src/server/domain/pots.ts):

```
cashRefunds = Σ credit_movements.amount where kind='refund', method='cash', cancelledAt IS NULL
cardRefunds = Σ credit_movements.amount where kind='refund', method='card', cancelledAt IS NULL

cash = …existing terms… − cashRefunds
card = …existing terms… − cardRefunds
```

Transfers do not appear in pot equations (no money moves).

**Team credit liability** (admin dashboard line):

```
totalCreditLiability = Σ creditBalance(m) over active members
```

### Domain layer

#### New module `src/server/domain/credit.ts`

Pure functions. Money mutations wrap reads + writes in a single SQLite transaction.

Reads:

```
getCreditBalance(db, userId): Promise<number>
listMemberCreditBalances(db): Promise<{ userId: string; balance: number }[]>
getTotalCreditLiability(db): Promise<number>
listCreditHistory(db, userId): Promise<CreditEvent[]>
```

`CreditEvent` is a tagged union for the member detail wallet view:
- `payment_deposit` — a payment with unallocated remainder (`payment.id`, `amount`, `unallocated`, `receivedAt`).
- `payment_consumption` — an allocation that consumed credit toward a charge (`payment.id`, `chargeId`, `amount`, charge description, occurredAt = allocation's parent payment receivedAt or the dues charge createdAt).
- `refund`, `transfer_in`, `transfer_out` — straight from `credit_movements`.

Writes:

```
recordCreditDeposit(db, { payerUserId, method, amount, note?, receivedAt?, createdByUserId })
applyCreditToCharge(db, { chargeId, amount, createdByUserId })
refundCredit(db, { userId, amount, method, note?, occurredAt?, createdByUserId })
transferCredit(db, { fromUserId, toUserId, amount, note?, occurredAt?, createdByUserId })
cancelCreditMovement(db, id)
```

- `recordCreditDeposit` inserts a `payments` row with zero allocations (same code path as `recordPayment` with `allocations = []`).
- `applyCreditToCharge` picks the member's payments with remaining credit FIFO and inserts `payment_allocations` rows totalling `amount`. Asserts charge is `open`, not cancelled, belongs to the user, and that resulting allocations don't exceed `charge.amount`.
- `refundCredit` inserts one `credit_movements` row, `kind='refund'`. Asserts `amount ≤ getCreditBalance(userId)`.
- `transferCredit` inserts paired rows sharing a `groupId`. Asserts `amount ≤ getCreditBalance(fromUserId)`, `fromUserId ≠ toUserId`, both users exist.
- `cancelCreditMovement` soft-cancels via `cancelledAt = now`. Transfers cancel both paired rows (look up via `groupId`). Rejected if cancellation would push any affected member's credit balance below zero.

#### Changes to `src/server/domain/payments.ts`

[`recordPayment`](../../../src/server/domain/payments.ts#L35-L111):

- Remove the `Σ allocations = amount` equality check.
- Replace with `Σ allocations ≤ amount` and allow `allocations.length === 0`.
- Keep per-allocation checks (charge belongs to payer, not cancelled, no overdraw).

Add helper:

```
sumUnallocatedForPayment(db, paymentId): Promise<number>
```

[`cancelPayment`](../../../src/server/domain/payments.ts#L146-L166): no functional change. Document that cancelling a credit-bearing payment causes the corresponding credit to vanish. Allocations from this payment are removed (existing behaviour), so any dues charges paid from this credit reopen via `recomputeChargeStatus`.

#### Auto-apply: when it fires

Auto-apply runs at three triggers so credit never sits idle next to an open dues charge:

1. **New dues charge created** — inside [`generateMonthlyDues`](../../../src/server/domain/dues.ts#L17-L63), after the insert (same transaction). The new charge is auto-paid from the member's credit FIFO.
2. **Credit deposited** — inside `recordCreditDeposit`, after the zero-allocation payment is inserted. Walks the member's open dues charges (oldest first by `charges.createdAt`) and consumes the fresh credit.
3. **Credit transferred in** — inside `transferCredit`, after the paired rows are inserted, the destination member's open dues charges get the same treatment.

For each (charge, available-credit) pair the algorithm is:

1. Look up the payer's available credit FIFO: oldest non-cancelled payment with remaining credit, by `payments.receivedAt ASC`, tie-break `payments.createdAt ASC`, final tie-break `payments.id ASC`.
2. Insert `payment_allocations` rows until the charge is covered or credit runs out.
3. Recompute the charge's status via `recomputeChargeStatus`.

Encapsulate the loop in `consumeCreditForCharge(tx, chargeId)` so all three trigger sites share one implementation. `applyCreditToCharge` (manual, non-dues) reuses the same helper.

Idempotency of `generateMonthlyDues` is preserved: it already skips charges that exist for the period, so re-running can't double-consume credit.

#### Changes to `src/server/domain/pots.ts`

Add `sumRefundsByMethod(db, method)` and incorporate into [`getPotBalances`](../../../src/server/domain/pots.ts#L39-L59). Two extra promises in the existing `Promise.all`.

#### Changes to activity / movements

[`activity.ts`](../../../src/server/domain/activity.ts) and [`movements.ts`](../../../src/server/domain/movements.ts) get new event kinds:

- `credit_deposit` — payment with any unallocated remainder at recording time, or a pure deposit. Carries `paymentId`, `userId`, `userName`, `amount`, `method`, `note`.
- `credit_refund` — admin refunded $X from a pot. Carries `movementId`, `userId`, `userName`, `amount`, `method`.
- `credit_transfer` — admin moved $X between members. Carries `groupId`, `fromUserId`, `toUserId`, names, `amount`.

Auto/manual applies of existing credit to charges are NOT separate activity events — they show up as the charge being created already-paid. No spam.

### Server actions

`src/server/actions/credit-server.ts` and `credit.ts`, wrapped via the existing [`_wrapper.ts`](../../../src/server/actions/_wrapper.ts) admin-gate pattern:

- `recordCreditDeposit` (admin)
- `applyCreditToCharge` (admin)
- `refundCredit` (admin)
- `transferCredit` (admin)
- `cancelCreditMovement` (admin)
- `getCreditBalance` — readable by member for themselves, admin for anyone (mirror existing per-member auth pattern).

### UI — admin web

#### Member dashboard / mini-app home

A new card next to the existing balance widget on `/dashboard` and `/mini`:

```
Subscription wallet
$30.00
Covers ~2 months of dues at $15/mo
```

Hidden when balance is zero. Member-only view: each member sees only their own.

#### Members roster (`/members`)

A new **Credit** column between **Display name** and **Outstanding debt**. Sortable. Shows `—` when zero.

#### Member detail (`/members/[id]`)

A new **Subscription wallet** section under the existing summary:

- Balance.
- Movement history (deposits, applies to charges, refunds, transfers) ordered by `occurredAt` desc.
- Admin actions:
  - **+ Deposit to wallet** — modal: amount, method, note, received-at. Calls `recordCreditDeposit`.
  - **Refund** — visible when balance > 0. Modal: amount, method, note. Calls `refundCredit`.
  - **Transfer** — visible when balance > 0. Modal: destination member, amount, note. Calls `transferCredit`.
- Each history row has a "Cancel" action calling `cancelCreditMovement` (movements) or `cancelPayment` (deposit's source payment), with a confirmation modal.

#### Admin team dashboard (`/dashboard`)

One new line under pot balances:

```
Members' prepaid credit (liability): $45.00
```

Click-through to `/members`.

#### Updated `/payments/new`

Two changes:

1. The amount input no longer hard-caps at outstanding debt. If `amount > debt`, an inline note appears: "$X will be added to <member>'s subscription wallet."
2. New optional toggle at the top: **"Deposit only (no charges to settle)"**. When selected, the form skips the allocations UI — just amount + method + note + received-at. Submits via `recordCreditDeposit`. This is the standalone-deposit entry point.

#### Charges (`/charges/[id]` or row actions on `/charges`)

For non-dues charges, when the charged member has credit, a new admin button:

> **Pay from credit** ($30.00 available)

Opens a confirmation showing how much credit will be consumed (`min(charge remaining, credit available)`). On confirm, calls `applyCreditToCharge`.

### UI — Mini App

- `/mini` home shows the **Subscription wallet** card for the signed-in member when balance > 0.
- `/mini/payments/new` adds the same "Deposit only" toggle on the new-payment sheet for admin.
- `/mini/members/[id]` (member detail) shows the wallet section with Deposit / Refund / Transfer actions in sheet UI.

### Bot

Three new conversations in `src/server/bot/conversations/`:

- `/wallet` (everyone) — DM the caller their current credit balance and last 5 wallet events.
- `/deposit` (admin) — conversation: pick member → amount → method → optional note → confirm. Calls `recordCreditDeposit`. Registered alongside other admin commands in [`admin-commands.ts`](../../../src/server/bot/admin-commands.ts).
- `/refund` (admin) — conversation: pick member with credit > 0 → amount → method → optional note → confirm.

The existing `/pay` admin conversation gains a final prompt when amount exceeds open debt: "Amount is $X more than open debt. Deposit excess to <member>'s wallet? [Yes / No]". On Yes, the bot submits the payment with partial allocations + credit remainder. On No, it re-asks for a smaller amount.

Transfer and manual-apply remain web/mini-only — out of v1 bot scope.

### Notifications

Add to [`src/server/bot/notifications.ts`](../../../src/server/bot/notifications.ts):

- **Credit deposited** → "$X added to your subscription wallet. Balance: $Y."
- **Credit auto-applied to dues** → "Monthly dues for <Month> were paid from your wallet ($X). Wallet balance: $Y." (sent once per affected member per dues generation).
- **Credit refunded** → "$X refunded from your wallet via <cash|card>. Wallet balance: $Y."
- **Credit transferred** → "$X transferred from your wallet to <Member>." / "<Member> transferred $X to your wallet."

### i18n

New keys under `m.wallet.*` for en and ru: card label, table column, history event labels, modal copy, bot prompts, notification templates. Follow the existing nested-namespace convention in [`src/shared/i18n/`](../../../src/shared/i18n/).

## Edge cases and invariants

### Cancellation cascades

- **Cancel a payment with unallocated credit**: credit contribution disappears immediately. Any allocations from this payment to dues are removed via existing cancel logic; affected dues charges reopen. If the result pushes the member's credit balance below zero, that's surfaced as outstanding debt on the reopened charges. No special handling needed.
- **Cancel a dues charge that has allocations**: behaviour change. Today [`cancelCharge`](../../../src/server/domain/charges.ts#L108-L120) forbids cancellation when any allocations exist. New rule for `monthly_dues` charges only: cancellation atomically removes the allocations (restoring credit to the source payments) and marks the charge cancelled. No money moves — the source payments' totals are unchanged. Other charge types (`adhoc`, `out_of_bounds`, `pot_borrow`) keep the existing restriction; the admin must cancel the parent payments first.
- **Cancel a `credit_movements` row**: soft-cancel via `cancelledAt`. For a transfer, both paired rows cancel together (look up via `groupId`). Reject the cancellation if it would push any affected member's credit balance below zero — admin must resolve manually.

### Deactivation guard

In [`src/server/domain/members.ts`](../../../src/server/domain/members.ts) deactivation: no hard block. The server action returns a `requiresConfirmation` flag plus the current credit balance when `balance > 0`. The UI shows a confirmation modal; confirmed submission passes `force: true`. The credit persists; reactivation restores wallet UI access.

### FIFO ordering

Both auto-apply and manual-apply pick the member's payments with remaining credit in this order:

1. Non-cancelled.
2. `payments.receivedAt ASC`.
3. Tie-break: `payments.createdAt ASC`.
4. Final tie-break: `payments.id ASC`.

Deterministic and stable across reruns (matters for tests).

### Concurrency

All credit-related writes happen inside an outer SQLite transaction wrapping the read of available credit + the inserted allocations / movements. SQLite WAL mode serialises writers — no double-spend race. Same pattern as the existing [`recordPayment`](../../../src/server/domain/payments.ts#L76-L98).

### Invariants enforced in code

- `Σ allocations.amount for a payment ≤ payment.amount` (was `=`).
- `Σ allocations.amount for a charge ≤ charge.amount` (unchanged).
- `creditBalance(member) ≥ 0` (checked before every credit-spending operation; never written negative).

Refund pot deduction is not hard-bounded — pots can already go negative today via spendings, and that's the project's choice for v1.

## Migration and rollout

### Drizzle migration `drizzle/0005_*.sql`

Two parts in one migration file:

1. `CREATE TABLE credit_movements (...)` with the columns from the schema section and indexes:
   - `credit_movements(user_id)`
   - `credit_movements(kind, cancelled_at)`
   - `credit_movements(group_id)`
2. Wipe test-only money data:
   ```sql
   DELETE FROM payment_allocations;
   DELETE FROM payments;
   DELETE FROM spendings;
   DELETE FROM guest_deposits;
   DELETE FROM charges;
   UPDATE settings SET last_dues_generated_for = NULL;
   ```
   **Preserved**: `users`, `sessions`, `invites`, `categories`, `info_pages`, `guests`, `settings` (apart from `last_dues_generated_for`).

   Order: child rows before parents.

### Deploy steps

Standard pipeline:

1. Push to `main`. GitHub Actions builds and pushes image.
2. Watchtower rolls the container on the TrueNAS host (192.168.1.9).
3. [`docker-entrypoint.sh`](../../../docker-entrypoint.sh) applies migration `0005` idempotently on container start.

No data backfill needed (nothing to migrate; everything we'd migrate just got wiped).

### Backup before rollout

Before the deploy that includes migration `0005`, snapshot `./data/team_budget.db` on the TrueNAS host. The migration is destructive for money rows. One-time manual step.

### Feature flag

None. Ship live. The behaviour change is mostly opt-in (`recordPayment` continues to work fully-allocated; only an over-amount opts into the new code path), so there's no transition mode to manage.

### v1 spec updates

Update [`docs/superpowers/specs/2026-05-19-team-budget-design.md`](2026-05-19-team-budget-design.md):

- §3.6 Payments — relax the "must fully allocate" wording.
- §3.9 Derived values — add the credit-balance formula and the pot-balance refund term.
- §13 Out of scope — strike "Floating credit / overpayments".

## Tests

Domain unit tests (Vitest) in `tests/domain/`:

- `credit.test.ts`:
  - `recordCreditDeposit` with zero allocations creates a payment row whose full amount becomes credit; pot increases by amount; credit balance increases.
  - `applyCreditToCharge` consumes credit FIFO; rejected when amount > available credit; rejected for cancelled charges; rejected when charge belongs to a different user; allocations don't exceed charge amount.
  - `refundCredit` decreases credit and pot (cash and card both verified); rejected when amount > balance.
  - `transferCredit` decreases source credit, increases destination credit, inserts paired rows sharing a `groupId`, leaves pot unchanged; rejected when from = to or amount > balance.
  - `cancelCreditMovement` reverses refund pot effect and transfer credit moves; cancels both paired transfer rows; rejected when it would push balance negative.
  - Credit balance correct across mixed deposits, allocations, refunds, and transfers.
  - Cancelling a credit-bearing payment removes credit and reopens dues charges it had auto-paid.
  - Cancelling a dues charge that was credit-paid is now allowed; credit is restored to the source payments.
- `dues.test.ts` (extended): `generateMonthlyDues` consumes available credit FIFO for each new dues charge; charge that was fully credit-paid is `paid` on creation; remainder if credit < dues stays open.
- `pots.test.ts` (extended): `getPotBalances` subtracts non-cancelled `kind='refund'` rows by method; cancelled refunds restore the pot.
- `payments.test.ts` (extended): `recordPayment` accepts `Σ allocations ≤ amount` and `allocations.length === 0`; the unallocated remainder appears in the member's credit balance.
- `activity.test.ts` / `movements.test.ts` (extended): new event kinds appear with correct fields.

Integration tests (Vitest) in `tests/integration/`:

- Server actions for credit deposit / refund / transfer / cancel / apply, including the admin-gate via `_wrapper.ts`.

No bot/UI e2e tests for credit in this iteration — the domain layer is where the invariants live.

## Open questions

None blocking. Future iterations may add: a dedicated `/credits` admin page if movement volume grows, bot commands for transfer and manual apply, credit expiry, and per-member detail metrics (e.g., months of dues covered).
