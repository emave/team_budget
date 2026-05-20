# Pot opening balances + BYN-only currency

## Problem

Two related gaps:

1. **No way to seed pots.** `getPotBalances` derives `cash` and `card` from `payments − spendings − pot_borrows`. The team did not start from zero — there is already real money in both pots — so the dashboard understates reality and there is no admin path to correct it short of editing the database.
2. **Currency is wrong.** The app ships with `currency='USD'` and renders amounts with a `$` prefix. The team operates in Belarusian rubles (BYN). Currency was originally configurable (USD/EUR/GBP/fallback), but a configurable currency selector is not wanted — single-currency BYN throughout.

## Scope

- Add an admin-editable opening balance per pot, included in the computed balance.
- Replace multi-currency formatting with a single hardcoded BYN format (`<amount> р.`).
- Remove the now-unused `currency` setting from schema, storage, and code paths.

Out of scope:
- A currency selector UI.
- An audit-trail entity for "pot adjustments" (one-time openings only; future corrections still happen via `payments` / `spendings`).
- Renaming `parseDollarsToCents` (the name becomes inaccurate but the function works for BYN; rename is unrelated cleanup).

## Design

### Schema

`src/server/db/schema.ts` — `settings` table:

- Add `cashOpeningCents: integer('cash_opening_cents').notNull().default(0)`
- Add `cardOpeningCents: integer('card_opening_cents').notNull().default(0)`
- Remove `currency: text('currency').notNull().default('USD')`

New Drizzle migration `drizzle/0003_*.sql`:

```sql
ALTER TABLE settings ADD COLUMN cash_opening_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN card_opening_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings DROP COLUMN currency;
```

Single-tenant self-host deployment. The existing `id=1` row picks up `0` for both new columns; admin sets real values via the new UI on first use.

### Pot balance calculation

`src/server/domain/pots.ts` — `getPotBalances(db)`:

```ts
const s = await getOrCreateSettings(db);
// existing aggregations…
return {
  cash: s.cashOpeningCents + cashIn - cashOut - cashBorrow,
  card: s.cardOpeningCents + cardIn - cardOut - cardBorrow,
};
```

No change to the function's public signature or to callers — they already pass through the computed numbers.

### Currency formatting

`src/shared/format.ts` becomes single-currency:

```ts
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${whole}.${rem.toString().padStart(2, '0')} р.`;
}

export function parseDollarsToCents(input: string): number { /* unchanged */ }
```

`src/server/domain/money.ts` currently duplicates the format helper. Delete `formatAmount` and route its callers (if any) to `formatCents` from `@/shared/format`.

Every call site of the form `formatCents(x, settings.currency)` becomes `formatCents(x)`. Affected files include:

- `src/app/(app)/dashboard/page.tsx`, `dashboard/pot-card.tsx`
- `src/app/(app)/settings/dues-form.tsx`
- `src/server/bot/handlers/balance.ts`, `team.ts`, `history.ts`, `menu.ts`
- `src/server/bot/conversations/charge.ts`, `pay.ts`, `spend.ts`
- `src/server/actions/charges.ts`, `payments.ts`, `charges-server.ts`
- `src/server/jobs/monthly-dues.ts`
- `src/server/domain/stats.ts` — the `money.currency` field stays in the JSON response shape (the TrueNAS console dashboard reads this endpoint and may key on it). It is set to the literal string `'BYN'` instead of `settings.currency`.
- any other site grep finds

`PotCard` (`dashboard/pot-card.tsx`) loses its `currency` prop.

### Settings UI — opening balances form

`src/app/(app)/settings/page.tsx` gains a new panel between **Monthly dues** and **Categories**: **Opening pot balances**.

New client component `src/app/(app)/settings/pot-openings-form.tsx`, modeled on `dues-form.tsx`:

- Two amount inputs (Cash, Card), pre-filled with `s.cashOpeningCents` and `s.cardOpeningCents` formatted as `X.XX`.
- A single **Save** button submits both values via one server action call.
- Admin-only — the page already calls `requireAdmin`.
- Success toast on save.

New server action in `src/server/actions/settings.ts` → `updatePotOpenings({ cashCents, cardCents })`, wrapping a new domain function `updatePotOpenings(db, cash, card)` in `src/server/domain/settings.ts`. Validation: both values are non-negative integers (mirrors `updateMonthlyDuesAmount`).

### i18n

Add to both `src/shared/i18n/messages-en.ts` and `src/shared/i18n/messages-ru.ts`, under `settings`:

- `potOpeningsHeading` — "Opening pot balances" / "Начальные суммы по кассам"
- `cashOpeningLabel` — "Cash pot" / "Наличные"
- `cardOpeningLabel` — "Card pot" / "Карта"
- `potOpeningsSaved` — "Saved." / "Сохранено."

The catalog-parity test in `tests/shared/i18n-catalog-parity.test.ts` enforces both locales stay in sync.

### Tests

- `tests/domain/pots.test.ts` — two new cases:
  - opening balances set, no movements → pot balances equal openings.
  - opening + a payment + a spending → arithmetic includes opening.
- `tests/shared/format.test.ts` — rewrite for the new single-arg `formatCents`:
  - `1234.50 р.`, `0.00 р.`, `-5.00 р.`, integer cents not divisible by 100.
- `tests/domain/settings.test.ts` — add cases for `updatePotOpenings`: success, rejects negative, rejects non-integer.
- `tests/actions/settings-categories.test.ts` (or split): exercise the new action end-to-end.
- Update any bot snapshot/text tests that currently assert a `$` prefix.

## Acceptance criteria

- Admin opens `/settings`, sees a populated **Opening pot balances** section, edits both values, saves, and the new amounts appear immediately in the dashboard pot cards.
- Dashboard pot balance = opening + payments − spendings − pot_borrows.
- Every money string in the app and bot renders as `<amount> р.` — no `$`, `€`, `£`, `BYN `, or `USD ` anywhere.
- `settings.currency` is gone from schema, types, action responses, and DB rows.
- `/api/stats` still returns `money.currency` (as the literal `"BYN"`) so the TrueNAS console dashboard keeps working.
- Existing tests pass after their currency-arg removal; new tests cover openings and BYN format.

## Migration & rollout

Single-instance self-host on TrueNAS. Steps when deploying:

1. Build and ship the image.
2. Apply the new migration (existing manual `sqlite3` piped flow).
3. On first admin visit to `/settings`, set the real opening balances.

No data is lost — the `currency` column dropped only carried `'USD'`, which is replaced by the BYN-only display.
