# Manual per-user monthly dues charge — design

Date: 2026-05-22
Status: approved

## Goal

Let admins manually create a `monthly_dues` charge for a single member for a chosen `YYYY-MM`, using the current monthly dues amount. Reinforce existing idempotency so the daily cron never produces a duplicate charge when a member is already charged (or already paid) for the period.

## Motivation

Today the daily cron creates `monthly_dues` charges for every active member at the start of each month and then bails for the rest of the month (`settings.lastDuesGeneratedFor === currentPeriod` short-circuit). Members who join — or are reactivated — mid-month are not charged for the current month, and an admin has no in-app way to add their dues. This spec adds a per-user button on the member detail page that creates exactly one monthly dues charge for any chosen `YYYY-MM`.

## Non-goals

- Per-user override of the dues amount. The manual charge uses `settings.monthlyDuesAmount`, same as the cron.
- A bulk "charge selected members" UI.
- Changing the daily cron's monthly cadence (it remains one-shot per period).
- A Telegram bot command (admin-only via web UI).
- Charging inactive members (admin must reactivate first).

## User-visible behaviour

On `/members/[id]`, admins see a new "Monthly dues" block containing:

- A month picker (`<input type="month">`) defaulting to the current `YYYY-MM`.
- A button labelled "Charge {amount}" showing the current `monthlyDuesAmount`.
- If `monthlyDuesAmount <= 0`, the block is disabled with a hint to set the amount in `/settings`.

On submit:

- Success → the new charge appears in the member's existing charge list (page refresh). If the member had wallet credit, the charge may already be `paid`. The member receives the same Telegram notification they would have received from the cron.
- Conflict ("already charged for that period") → inline error with the existing charge's status and a link to view it. No duplicate is created.

## Architecture

### Domain layer — `src/server/domain/dues.ts`

New error type and function:

```ts
export class MemberAlreadyChargedError extends Error {
  constructor(public readonly existingCharge: Charge) {
    super(`member already has monthly_dues charge for ${existingCharge.billingPeriod}`);
  }
}

export interface ChargeMemberDuesInput {
  userId: string;
  period: string;       // YYYY-MM
  createdByUserId: string;
}

export async function chargeMemberDues(
  db: Db,
  input: ChargeMemberDuesInput,
): Promise<Charge>;
```

Behaviour:

1. Validate `period` matches `/^\d{4}-\d{2}$/`; throw if not.
2. Load settings; throw if `monthlyDuesAmount <= 0` (same error message as bulk path).
3. Load user; throw if not found or `isActive === false`.
4. Look up existing `monthly_dues` charge for `(userId, period)` in **any** status (`open`, `paid`, `cancelled`). If one exists, throw `MemberAlreadyChargedError(existingCharge)`.
5. Insert the charge: `type='monthly_dues'`, `amount=settings.monthlyDuesAmount`, `description="Monthly dues — ${period}"`, `status='open'`, `billingPeriod=period`, `createdByUserId=input.createdByUserId`.
6. Call `consumeCreditForCharge(db, chargeId)` — wallet credit auto-applies, possibly moving the charge to `paid`.
7. Return the (possibly now-paid) charge.
8. Does **not** touch `settings.lastDuesGeneratedFor` (that flag belongs to the cron's bulk run).

### Refactor of `generateMonthlyDues`

The per-user loop body in `generateMonthlyDues` becomes:

```ts
for (const u of active) {
  try {
    const c = await chargeMemberDues(db, {
      userId: u.id,
      period: input.period,
      createdByUserId: input.createdByUserId,
    });
    created += 1;
    createdIds.push(c.id);
  } catch (err) {
    if (err instanceof MemberAlreadyChargedError) continue;
    throw err;
  }
}
```

The `lastDuesGeneratedFor` short-circuit at the top remains unchanged. The existing `db.transaction((tx) => …)` wrapper around the loop is removed (each `chargeMemberDues` does its own insert + credit consumption — same net effect, since charge creation per user is independent). The post-loop `consumeCreditForCharge` is removed because it now happens inside `chargeMemberDues`.

### Action layer — `src/server/actions/charges.ts`

New admin action:

```ts
const chargeMemberDues = adminAction(async ({ user, db }, input: unknown) => {
  const p = chargeMemberDuesSchema.parse(input);
  try {
    const charge = await domainChargeMemberDues(db, {
      ...p,
      createdByUserId: user.id,
    });
    if (process.env.SKIP_BOT !== '1') {
      try { await notifyDuesCreated(db, charge); }
      catch (err) { console.error('[actions] notify failed:', err); }
    }
    return { ok: true as const, charge };
  } catch (err) {
    if (err instanceof MemberAlreadyChargedError) {
      return {
        ok: false as const,
        reason: 'already_charged' as const,
        existingChargeId: err.existingCharge.id,
        existingStatus: err.existingCharge.status,
      };
    }
    throw err;
  }
});
```

Exposed via `src/server/actions/charges-server.ts` for client use.

### Schema — `src/shared/schemas.ts`

```ts
export const chargeMemberDuesSchema = z.object({
  userId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
});
```

### Notification helper

Extract `notifyDuesCreated(db, charge: Charge)` from the existing post-creation block in `runMonthlyDuesOnce`:

- If `charge.status === 'open'`: send "🧾 Monthly dues for {period} have been added ({amount}). Type /balance to see total." to that user, localized.
- If `charge.status === 'paid'`: send the existing `wallet.notification.autoAppliedDues(period, amount, balance)` localized message.

`runMonthlyDuesOnce`:
- Keeps its bulk broadcast ("Monthly dues for {period} have been added to all members") — that announcement is about the cron event, not an individual charge.
- Its per-user "paid from wallet" loop is replaced with `notifyDuesCreated` calls for each charge it created, so both paths emit identical per-user wording.

### UI — `src/app/(app)/members/[id]/`

New client component `charge-dues-form.tsx`:

- Renders only when `viewerIsAdmin` (already computed by `page.tsx` for other admin blocks).
- `react-hook-form` with one field, `period`, defaulting to the current `YYYY-MM`.
- Submit handler uses `useMutation` against the `chargeMemberDues` server action.
  - On `{ ok: true }`: call `router.refresh()`. Show a transient "Charge created" ack.
  - On `{ ok: false, reason: 'already_charged' }`: show "Already charged for {period} ({status})" with a "View existing charge" link to `/charges?userId={userId}` (filter view exists today).
- Disabled when `monthlyDuesAmount <= 0`; shows a hint linking to `/settings`.

`page.tsx` already reads settings; it passes `monthlyDuesAmount` and the current viewer's admin status down to the new component.

### i18n keys

Added to `messages-en.ts` and `messages-ru.ts` under `members.dues`:

- `heading` — "Monthly dues"
- `monthLabel` — "Month"
- `chargeButton(amount)` — "Charge {amount}"
- `noAmountConfigured` — "Set monthly dues amount in Settings first"
- `alreadyCharged(period, status)` — "Already charged for {period} ({status})"
- `viewExisting` — "View existing charge"
- `successAck` — "Charge created"

## Tests

### `tests/domain/dues.test.ts` — extend

- `chargeMemberDues` happy path: returns charge with correct `userId`, `type`, `amount`, `billingPeriod`, `description`, `status`.
- Rejects invalid period format (`"2026-5"`, `"foo"`, empty string).
- Rejects when `monthlyDuesAmount <= 0`.
- Rejects when user does not exist.
- Rejects when user is inactive.
- Throws `MemberAlreadyChargedError` when prior charge exists for `(userId, period)` — exercised for each of `open`, `paid`, `cancelled`.
- Auto-consumes wallet credit when sufficient → returned charge has `status === 'paid'`.
- Does not modify `settings.lastDuesGeneratedFor`.

**Ask #3 regression test (explicit no-double-charge guarantee):**
- Member is manually charged for `2026-05`, then a payment marks the charge `paid`.
- `generateMonthlyDues({ period: '2026-05' })` is then called fresh (with `lastDuesGeneratedFor` cleared).
- Assert: `createdCount === activeMembers - 1`, the existing paid charge is unchanged, no second `monthly_dues` charge exists for that `(userId, period)`.

### `tests/actions/charges.test.ts` — extend

- Non-admin caller rejected by the wrapper.
- Happy path returns `{ ok: true, charge }`.
- Conflict returns `{ ok: false, reason: 'already_charged', existingChargeId, existingStatus }` — does not throw.
- Invalid `period` rejected by Zod (action does not reach the domain).

### Existing tests

Existing `generateMonthlyDues` tests must continue to pass unchanged after the refactor — they cover the bulk path's idempotency, wallet credit consumption, and `lastDuesGeneratedFor` writes.

## Data model

No schema changes. Uses existing `charges` table fields (`type='monthly_dues'`, `billingPeriod=YYYY-MM`).

## Risks

- **Refactor regression in `generateMonthlyDues`**. Mitigated by keeping all existing tests for the bulk path green and by the new `chargeMemberDues` tests covering identical logic.
- **Notification spam on backfill**. A member manually charged for a past period receives a "monthly dues added" notification. Acceptable — admin opted in by clicking the button.

## Out of scope (deferred)

- Charging inactive members directly.
- Bulk per-user UI.
- Telegram bot command for admin manual charge.
- Per-charge dues amount override.
