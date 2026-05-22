# Payment form redesign (direct allocation + wallet excess)

## Problem

The current `/payments/new` member-branch form ([src/app/(app)/payments/new/record-form.tsx](../../../src/app/(app)/payments/new/record-form.tsx)) leaves the submit button disabled whenever `!allocations` is true. Admins fill payer + amount + method + note, then sit on a disabled "Записать платёж" button with no visible reason — they're expected to press "Подобрать распределение (FIFO)" first, or check "Только пополнение (без погашения долгов)". Both controls clutter the form, and the "Только пополнение" checkbox is now redundant after [`feat/subscription-wallet`](2026-05-22-subscription-wallet-design.md): `recordPayment` already accepts `Σ allocations ≤ amount` (incl. `[]`), and any unallocated remainder becomes the payer's wallet credit which auto-applies to open dues on deposit.

We want one straightforward form: type allocations directly per open charge, with monthly subscription pre-filled FIFO; any excess goes to the wallet. The bot's `/pay` conversation is realigned to the same semantics — subscription-only.

## Scope

In:
- Rewrite the member-branch of `src/app/(app)/payments/new/record-form.tsx`: per-charge allocation table, monthly_dues pre-filled FIFO, excess indicator, no FIFO button, no deposit-only checkbox.
- New server action `listOpenChargesForPayer(payerUserId)`.
- Domain: add `chargeTypes?` filter to existing `fifoAllocate`; add `getMemberSubscriptionDebt`.
- Bot `/pay`: subscription-only FIFO; when subscription debt is zero, offer a "deposit to wallet?" branch instead of aborting.
- i18n: new keys; drop unused `payments.suggestFifo` and `wallet.depositToggle` if confirmed unreferenced.
- Unit tests for the new domain helpers; bot conversation test extended.

Out:
- Guest branch of the form (unchanged).
- `/deposit`, `/refund`, `/wallet` bot commands (unchanged).
- `/charges/[id]` "Pay from credit" admin action (unchanged — covers non-dues from credit).
- Mini App `/mini/payments/new` (does not exist).
- Domain `recordPayment` and `recordCreditDeposit` semantics (unchanged).
- Schema, migrations, notifications.

## Design

### Web — `/payments/new` (member branch)

Form fields and order:
1. Mode toggle (Member | Guest) — unchanged.
2. Плательщик — Select, unchanged.
3. Способ (cash | card) — Select, unchanged.
4. Сумма — Input, unchanged.
5. Заметка — Input, unchanged.
6. **Распределение** — new editable table.
7. Excess line.
8. Submit.

Allocation table:
- Visible as soon as `payerUserId` is set.
- Data source: new server action `listOpenChargesForPayer(payerUserId)` → array of `{ id, type, description, amount, allocatedCents, remainingCents, createdAt }` ordered by `createdAt ASC`.
- One row per open charge, columns: charge label (localised type + description), remaining, amount input (defaults to "" or to the pre-fill amount in dollars).
- Pre-fill rule, fired **on payer change** only (not on amount change):
  - For each `monthly_dues` charge in `createdAt ASC` order, take `min(remaining, amountLeft)` cents. Stop when `amountLeft <= 0`.
  - Non-dues rows (`adhoc`, `pot_borrow`, `out_of_bounds`, `split`) stay at zero.
- If `amount` changes after pre-fill, allocations are untouched. The admin sees the excess line update live and adjusts allocations manually if they want different routing.

Excess line, computed from `amountCents − Σ allocationsCents`:
- `excess > 0` → `Излишек: $X.XX → кошелёк <member>` (neutral colour, not an error).
- `excess === 0` → no line.
- `excess < 0` → `Распределено больше суммы` (error colour); submit disabled.

No-open-charges case: instead of the table, render one info line:
> Открытых начислений нет. Сумма поступит в кошелёк <member> и автоматически покроет ближайшую месячную подписку.

Submit:
- Enabled when `payer && amountCents > 0 && Σ allocCents <= amountCents`.
- Calls existing `recordPayment` server action with `allocations` filtered to entries `> 0` cents. Empty array is valid.
- On success: `router.push('/payments')`.

Removed UI:
- "Подобрать распределение (FIFO)" button + the `suggestFifoAllocation` mutation.
- "Только пополнение (без погашения долгов)" checkbox + the `depositOnly` state.
- The `recordCreditDeposit` client call from this form (no longer needed; `recordPayment` with empty allocations behaves identically per [subscription-wallet spec](2026-05-22-subscription-wallet-design.md#L148)).

### Server actions

Add to [src/server/actions/payments-server.ts](../../../src/server/actions/payments-server.ts):

```ts
export async function listOpenChargesForPayer(input: { payerUserId: string })
  : Promise<{ id: string; type: string; description: string; amount: number; remainingCents: number; createdAt: string }[]>
```

Thin wrapper around `listOpenChargesForMember` + `sumAllocationsForCharge`. No new auth — already inside the admin-gated `/payments/new` route group.

The old `suggestFifoAllocation` server action is no longer called from the UI; remove the export and its domain pass-through.

### Domain

[src/server/domain/charges.ts](../../../src/server/domain/charges.ts) — add:

```ts
export async function getMemberSubscriptionDebt(db: Db, userId: string): Promise<number>
```

Sums `c.amount − allocated` over open `monthly_dues` charges for `userId`. Mirrors `getMemberOutstandingDebt` with `c.type === 'monthly_dues'` filter.

[src/server/domain/payments.ts](../../../src/server/domain/payments.ts) — extend `fifoAllocate`:

```ts
export async function fifoAllocate(
  db: Db,
  payerUserId: string,
  amount: number,
  opts?: { chargeTypes?: ChargeType[] },
): Promise<AllocationInput[]>
```

When `opts.chargeTypes` is set, filter the candidate charges by type before iterating. Default = no filter (backward compatible — current callers unchanged). Bot calls with `{ chargeTypes: ['monthly_dues'] }`.

### Bot — `/pay` conversation

[src/server/bot/conversations/pay.ts](../../../src/server/bot/conversations/pay.ts) reworked:

1. Pick payer (unchanged).
2. `const subDebt = await getMemberSubscriptionDebt(db, payerId)`.
3. If `subDebt > 0`:
   - Prompt: "Подписка: должен $X. Сколько внести?" (`bot.pay.subscriptionDebtPrompt`).
   - Parse amount.
   - If `cents > subDebt` → reuse the existing over-payment prompt (`wallet.bot.payOverpaymentPrompt`) with copy tweaked to say "открытой подписки" instead of "долга". Yes → continue; No → abort.
4. If `subDebt === 0`:
   - Prompt: "Открытой подписки нет. Сумма пойдёт в кошелёк <member>. Продолжить?" (`bot.pay.noSubscriptionDebtConfirm`). Yes / No.
   - On Yes: ask "Сколько внести?" (`bot.pay.depositAmountPrompt`), parse amount.
   - On No: abort.
5. Pick method (cash | card) — unchanged.
6. `const allocations = await fifoAllocate(db, payerId, cents, { chargeTypes: ['monthly_dues'] })`.
7. `recordPayment(...)`. Excess naturally becomes credit; `recordCreditDeposit`-style auto-apply does NOT run here (we're on the `recordPayment` path, which doesn't auto-apply), but in this conversation we already covered dues FIFO before the excess existed — so there are no remaining open dues for the excess to cover at this instant. Wallet sits and absorbs the next dues generation.
8. Reply text:
   - Subscription-debt path: `bot.pay.recorded(method, amount, remainingDebt)` (existing, unchanged except `remainingDebt` is now subscription remaining).
   - No-debt path: `bot.pay.depositedToWallet(member, amount, walletBalance)`.
9. Notify payer (existing path, both branches).

### i18n

Add to `bot.pay` (both EN and RU):
- `subscriptionDebtPrompt(formattedDebt)` — replaces `owesAmountPrompt` for the dues-only world; the old key can stay for callers but the bot now uses the new key.
- `noSubscriptionDebtConfirm(memberName)` — Yes/No prompt copy.
- `depositAmountPrompt` — short amount-only prompt after the Yes.
- `depositedToWallet(memberName, amount, balance)` — success reply.

Tweak `wallet.bot.payOverpaymentPrompt` Russian copy: "Сумма на $X больше открытой подписки — добавить излишек в кошелёк <member>? Да / Нет." (EN: open subscription instead of open debt.) This is shared with the web form and matches the new mental model.

Add to `payments` (web):
- `allocationsHeading` already exists ("Распределение:"); reuse.
- `allocationsTableCharge` — column header "Начисление".
- `allocationsTableRemaining` — column header "Открыто".
- `allocationsTableAmount` — column header "Сумма".
- `allocatedTotal(formattedSum, formattedAmount)` — "Распределено: $X / $Y" footer.
- `excessToWallet(formattedExcess, memberName)` — "Излишек: $X → кошелёк <member>".
- `allocationsExceed` — "Распределено больше суммы" error.
- `noOpenChargesHint(memberName)` — "Открытых начислений нет. Сумма поступит в кошелёк <member> и автоматически покроет ближайшую месячную подписку."

Remove:
- `payments.suggestFifo` — no longer called from any UI.
- `wallet.depositToggle` — if grep confirms no other reference, remove. Otherwise leave.

### Tests

Unit (Vitest, `tests/domain/`):
- `member-debt.test.ts` (extended): `getMemberSubscriptionDebt` returns sum of open monthly_dues only; excludes adhoc/pot_borrow; respects allocations and cancellations.
- `fifo-allocate.test.ts` (extended): `fifoAllocate(..., { chargeTypes: ['monthly_dues'] })` skips non-dues charges and stops at total dues remaining; default behaviour unchanged.

Integration (Vitest, `tests/integration/bot/` if structure exists, else inline conversation tests):
- `/pay` with subscription debt + adhoc charge: paying amount equal to subscription debt allocates entirely to dues; the adhoc remains open.
- `/pay` with no subscription debt and confirm-yes: the payment becomes credit; member's wallet balance increases by the amount.
- `/pay` over-payment confirm-yes: subscription is fully paid; excess is wallet credit.

No e2e/UI tests for the web form in this iteration (the disabled-button bug is exactly the kind of UX regression manual smoke testing catches; relying on type-checking + domain coverage).

## Edge cases

- **Admin clears all allocations and submits** → entire amount becomes wallet credit. Existing `recordPayment` path. Auto-apply to dues happens at next dues generation (not at deposit time, because the deposit-time auto-apply only fires in `recordCreditDeposit`, not in `recordPayment`). Acceptable: the dues this payment was intended for are by definition already covered (otherwise the admin would have allocated to them).
- **Admin allocates less than amount with some open dues remaining** → excess → credit (zero-allocation portion). The remaining open dues stay open until the next dues generation, when wallet auto-apply consumes the credit. Same as above — admin's choice.
- **Payer change with non-empty allocations** → allocations are discarded and re-pre-filled from the new payer's open charges. (Implementation: keyed effect on `payerUserId`.)
- **Amount typed before payer chosen** → allocation table is empty (no payer = no charges to list); submit disabled by `!payer`.
- **Multiple admins racing on the same charge** → existing `recordPayment` overdraw guard catches it server-side (`sumAllocationsForCharge` check).

## Migration and rollout

No schema changes, no migration. Pure UI + bot logic change.

Deploy: standard pipeline (push → GitHub Actions → image → Watchtower roll on TrueNAS).

Feature flag: none.

## Open questions

None blocking. A future iteration could add a "spread excess across remaining open charges" button in the web form, but YAGNI for now.
