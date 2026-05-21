# Dashboard Money-Flow Timesheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin dashboard's mixed activity feed with a Tempo-style 2D timesheet grid — per-member lanes for deposits, two pot lanes (Cash/Card) for withdrawals, days across the X axis, event cards in cells.

**Architecture:** Next 14 server component reads `?from`/`?to` from `searchParams`, resolves to a date range (default = current calendar month, clamped to 90 days), calls a new `listMoneyMovements` domain function (Drizzle on better-sqlite3) that returns deposits + withdrawals as a discriminated union. A new `'use client'` `<MoneyHistory>` component renders the grid + a BaseWeb `DatePicker` (range mode); picker changes push `?from=…&to=…` and let the server re-render.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Drizzle ORM, better-sqlite3, BaseWeb (`baseui`), Vitest.

**Reference spec:** [docs/superpowers/specs/2026-05-21-dashboard-money-history-design.md](docs/superpowers/specs/2026-05-21-dashboard-money-history-design.md)

---

## File Structure

**New files:**
- `src/server/domain/movements.ts` — `listMoneyMovements` + `Movement` union type.
- `src/shared/date-range.ts` — pure helpers: `resolveDashboardRange`, `eachDayBetween`, `isoDay`. Tested in isolation.
- `src/app/(app)/dashboard/money-history.tsx` — `'use client'` component: grid + range picker + clamp notice.
- `tests/domain/movements.test.ts` — unit tests for `listMoneyMovements`.
- `tests/shared/date-range.test.ts` — unit tests for range helpers.

**Modified files:**
- `src/app/(app)/dashboard/page.tsx` — read `searchParams`, build range, call new domain fn, render `<MoneyHistory>` instead of `<ActivityFeed>`.
- `src/shared/i18n/messages-en.ts` — add `dashboard.movementsHeading`, `noMovements`, `rangeClamped(n)`, `laneCashPot`, `laneCardPot`. Remove `activityHeading`, `noActivity`, `chargeLine`, `paymentLine`, `spendingLine`, `colEvent`, `colWhen`.
- `src/shared/i18n/messages-ru.ts` — same key changes, Russian copy.

**Deleted files:**
- `src/app/(app)/dashboard/activity.tsx` — replaced by `money-history.tsx`.
- `src/server/domain/activity.ts` + `tests/domain/activity.test.ts` — `recentActivity` and its only test, no longer used.

---

## Task 1: Domain function `listMoneyMovements`

**Files:**
- Create: `src/server/domain/movements.ts`
- Test: `tests/domain/movements.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `tests/domain/movements.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { listMoneyMovements } from '@/server/domain/movements';
import { payments, spendings } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

describe('listMoneyMovements', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  let memberId2: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })).id;
    memberId2 = (await createUser(db, { telegramUserId: 3, displayName: 'B', role: 'member' })).id;
  });

  it('returns deposits and withdrawals merged and sorted desc by business date', async () => {
    const c1 = await createAdhocCharge(db, { userId: memberId, amount: 500, description: 'gear', createdByUserId: adminId });
    await recordPayment(db, {
      payerUserId: memberId, method: 'cash', amount: 500,
      receivedAt: '2026-05-10T10:00:00.000Z',
      allocations: [{ chargeId: c1.id, amount: 500 }],
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'card', amount: 200, description: 'field fee',
      occurredAt: '2026-05-12T10:00:00.000Z',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, { userId: memberId2, amount: 300, description: 'g2', createdByUserId: adminId });
    await recordPayment(db, {
      payerUserId: memberId2, method: 'card', amount: 300,
      receivedAt: '2026-05-11T10:00:00.000Z',
      allocations: [{ chargeId: c2.id, amount: 300 }],
      createdByUserId: adminId,
    });

    const rows = await listMoneyMovements(db, { from: '2026-05-01', to: '2026-05-31' });
    expect(rows.map((r) => r.kind)).toEqual(['withdraw', 'deposit', 'deposit']);
    expect(rows[0]).toMatchObject({ kind: 'withdraw', pot: 'card', amount: 200, description: 'field fee' });
    expect(rows[1]).toMatchObject({ kind: 'deposit', payerDisplayName: 'B', amount: 300, method: 'card' });
    expect(rows[2]).toMatchObject({ kind: 'deposit', payerDisplayName: 'V', amount: 500, method: 'cash' });
  });

  it('excludes rows outside the range (inclusive on both ends, with end-of-day on `to`)', async () => {
    const c = await createAdhocCharge(db, { userId: memberId, amount: 100, description: 'x', createdByUserId: adminId });
    await recordPayment(db, {
      payerUserId: memberId, method: 'cash', amount: 100,
      receivedAt: '2026-05-31T23:30:00.000Z',
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'cash', amount: 50, description: 'before',
      occurredAt: '2026-04-30T23:30:00.000Z',
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'cash', amount: 70, description: 'after',
      occurredAt: '2026-06-01T00:30:00.000Z',
      createdByUserId: adminId,
    });
    const rows = await listMoneyMovements(db, { from: '2026-05-01', to: '2026-05-31' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'deposit', amount: 100 });
  });

  it('excludes cancelled payments and spendings', async () => {
    const c = await createAdhocCharge(db, { userId: memberId, amount: 100, description: 'x', createdByUserId: adminId });
    const paid = await recordPayment(db, {
      payerUserId: memberId, method: 'cash', amount: 100,
      receivedAt: '2026-05-10T10:00:00.000Z',
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    const sp = await recordSpending(db, {
      pot: 'cash', amount: 50, description: 'ammo',
      occurredAt: '2026-05-11T10:00:00.000Z',
      createdByUserId: adminId,
    });
    db.update(payments).set({ cancelledAt: '2026-05-15T10:00:00.000Z' }).where(eq(payments.id, paid.payment.id)).run();
    db.update(spendings).set({ cancelledAt: '2026-05-15T10:00:00.000Z' }).where(eq(spendings.id, sp.id)).run();

    const rows = await listMoneyMovements(db, { from: '2026-05-01', to: '2026-05-31' });
    expect(rows).toEqual([]);
  });

  it('returns empty array when no rows in range', async () => {
    const rows = await listMoneyMovements(db, { from: '2026-01-01', to: '2026-01-31' });
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 1.2: Run the test — should fail (no module)**

Run: `pnpm vitest run tests/domain/movements.test.ts`
Expected: FAIL — `Cannot find module '@/server/domain/movements'` (or similar).

- [ ] **Step 1.3: Implement `listMoneyMovements`**

Create `src/server/domain/movements.ts`:

```ts
import { and, eq, gte, isNull, lte, desc } from 'drizzle-orm';
import { payments, spendings, users } from '@/server/db/schema';
import type { Db } from './types';

export type Movement =
  | {
      kind: 'deposit';
      id: string;
      at: string;
      amount: number;
      method: 'cash' | 'card';
      payerUserId: string;
      payerDisplayName: string;
      note: string | null;
    }
  | {
      kind: 'withdraw';
      id: string;
      at: string;
      amount: number;
      pot: 'cash' | 'card';
      description: string;
    };

// `amount` is always positive in cents (as stored in DB);
// callers add the sign when rendering, based on `kind`.

export async function listMoneyMovements(
  db: Db,
  range: { from: string; to: string },
): Promise<Movement[]> {
  const fromBound = `${range.from}T00:00:00.000Z`;
  const toBound = `${range.to}T23:59:59.999Z`;

  const ps = db
    .select({
      id: payments.id,
      at: payments.receivedAt,
      amount: payments.amount,
      method: payments.method,
      payerUserId: payments.payerUserId,
      payerDisplayName: users.displayName,
      note: payments.note,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.payerUserId))
    .where(
      and(
        isNull(payments.cancelledAt),
        gte(payments.receivedAt, fromBound),
        lte(payments.receivedAt, toBound),
      ),
    )
    .all();

  const ss = db
    .select({
      id: spendings.id,
      at: spendings.occurredAt,
      amount: spendings.amount,
      pot: spendings.pot,
      description: spendings.description,
    })
    .from(spendings)
    .where(
      and(
        isNull(spendings.cancelledAt),
        gte(spendings.occurredAt, fromBound),
        lte(spendings.occurredAt, toBound),
      ),
    )
    .all();

  const merged: Movement[] = [
    ...ps.map((p): Movement => ({
      kind: 'deposit',
      id: p.id,
      at: p.at,
      amount: p.amount,
      method: p.method,
      payerUserId: p.payerUserId,
      payerDisplayName: p.payerDisplayName,
      note: p.note,
    })),
    ...ss.map((s): Movement => ({
      kind: 'withdraw',
      id: s.id,
      at: s.at,
      amount: s.amount,
      pot: s.pot,
      description: s.description,
    })),
  ];

  merged.sort((a, b) => {
    if (a.at !== b.at) return a.at > b.at ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });

  return merged;
}
```

The `desc` import is unused; remove it before saving.

- [ ] **Step 1.4: Run the test — should pass**

Run: `pnpm vitest run tests/domain/movements.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 1.5: Commit**

```bash
git add src/server/domain/movements.ts tests/domain/movements.test.ts
git commit -m "feat(movements): listMoneyMovements domain function"
```

---

## Task 2: Date-range helpers

**Files:**
- Create: `src/shared/date-range.ts`
- Test: `tests/shared/date-range.test.ts`

These helpers are pure (no DB, no React). They live in `shared/` because both server (`page.tsx`) and client (`money-history.tsx`) will use them.

- [ ] **Step 2.1: Write the failing test**

Create `tests/shared/date-range.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isoDay, eachDayBetween, resolveDashboardRange, MAX_RANGE_DAYS } from '@/shared/date-range';

describe('isoDay', () => {
  it('formats a Date as YYYY-MM-DD in UTC', () => {
    expect(isoDay(new Date('2026-05-21T12:34:56.000Z'))).toBe('2026-05-21');
  });
});

describe('eachDayBetween', () => {
  it('returns inclusive list of YYYY-MM-DD strings', () => {
    expect(eachDayBetween('2026-05-29', '2026-06-02')).toEqual([
      '2026-05-29', '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02',
    ]);
  });
  it('returns single day when from == to', () => {
    expect(eachDayBetween('2026-05-21', '2026-05-21')).toEqual(['2026-05-21']);
  });
});

describe('resolveDashboardRange', () => {
  const today = new Date('2026-05-21T12:00:00.000Z');

  it('defaults to 1st of current month → today when params absent', () => {
    expect(resolveDashboardRange({}, today)).toEqual({
      from: '2026-05-01', to: '2026-05-21', clamped: false,
    });
  });

  it('parses valid YYYY-MM-DD inputs', () => {
    expect(resolveDashboardRange({ from: '2026-04-10', to: '2026-04-20' }, today)).toEqual({
      from: '2026-04-10', to: '2026-04-20', clamped: false,
    });
  });

  it('falls back to defaults on malformed inputs', () => {
    expect(resolveDashboardRange({ from: 'bogus', to: '2026-04-20' }, today)).toEqual({
      from: '2026-05-01', to: '2026-05-21', clamped: false,
    });
    expect(resolveDashboardRange({ from: '2026/04/10' }, today)).toEqual({
      from: '2026-05-01', to: '2026-05-21', clamped: false,
    });
  });

  it('swaps from/to when reversed', () => {
    expect(resolveDashboardRange({ from: '2026-04-20', to: '2026-04-10' }, today)).toEqual({
      from: '2026-04-10', to: '2026-04-20', clamped: false,
    });
  });

  it('clamps ranges wider than MAX_RANGE_DAYS by narrowing `from`', () => {
    const out = resolveDashboardRange({ from: '2025-01-01', to: '2026-05-21' }, today);
    expect(out.to).toBe('2026-05-21');
    expect(out.clamped).toBe(true);
    expect(eachDayBetween(out.from, out.to).length).toBe(MAX_RANGE_DAYS);
  });

  it('MAX_RANGE_DAYS is 90', () => {
    expect(MAX_RANGE_DAYS).toBe(90);
  });
});
```

- [ ] **Step 2.2: Run the test — should fail (no module)**

Run: `pnpm vitest run tests/shared/date-range.test.ts`
Expected: FAIL — cannot resolve `@/shared/date-range`.

- [ ] **Step 2.3: Implement `src/shared/date-range.ts`**

```ts
export const MAX_RANGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDay(s: string): Date | null {
  if (!ISO_DAY_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eachDayBetween(from: string, to: string): string[] {
  const start = parseIsoDay(from);
  const end = parseIsoDay(to);
  if (!start || !end) return [];
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    out.push(isoDay(new Date(t)));
  }
  return out;
}

export interface ResolvedRange {
  from: string;
  to: string;
  clamped: boolean;
}

function firstOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function resolveDashboardRange(
  input: { from?: string; to?: string },
  now: Date = new Date(),
): ResolvedRange {
  const defaultTo = isoDay(now);
  const defaultFrom = isoDay(firstOfMonth(now));

  const fromParsed = input.from ? parseIsoDay(input.from) : null;
  const toParsed = input.to ? parseIsoDay(input.to) : null;
  if (!fromParsed || !toParsed) {
    return { from: defaultFrom, to: defaultTo, clamped: false };
  }

  let from = fromParsed;
  let to = toParsed;
  if (from.getTime() > to.getTime()) [from, to] = [to, from];

  const spanDays = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (spanDays > MAX_RANGE_DAYS) {
    const clampedFrom = new Date(to.getTime() - (MAX_RANGE_DAYS - 1) * DAY_MS);
    return { from: isoDay(clampedFrom), to: isoDay(to), clamped: true };
  }
  return { from: isoDay(from), to: isoDay(to), clamped: false };
}
```

- [ ] **Step 2.4: Run the test — should pass**

Run: `pnpm vitest run tests/shared/date-range.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 2.5: Commit**

```bash
git add src/shared/date-range.ts tests/shared/date-range.test.ts
git commit -m "feat(date-range): pure helpers for dashboard range resolution"
```

---

## Task 3: i18n keys

**Files:**
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`

We add the new keys *and* remove the now-unused ones (`activityHeading`, `noActivity`, `chargeLine`, `paymentLine`, `spendingLine`, `colEvent`, `colWhen`). They are referenced only by `dashboard/activity.tsx` and `dashboard/page.tsx`, both rewritten in later tasks. The Messages type derives from `MESSAGES_EN`, so the two files must stay structurally identical.

- [ ] **Step 3.1: Update `messages-en.ts` `dashboard` block**

Open `src/shared/i18n/messages-en.ts` and replace the `dashboard: { ... }` block (currently lines ~58–78) with:

```ts
  dashboard: {
    cashPot: 'Cash pot',
    cardPot: 'Card pot',
    movementsHeading: 'Money flow',
    noMovements: 'Nothing in this period.',
    rangeClamped: (maxDays: number) => `Range narrowed to last ${maxDays} days.`,
    laneCashPot: 'Cash',
    laneCardPot: 'Card',
    youOwe: (name: string) => `${name} — You owe`,
    youSettled: (name: string) => `${name} — Settled`,
    teamSummary: 'Team summary',
    potsLine: (cash: string, card: string) => `Cash pot ${cash} · Card pot ${card}`,
    membersHeading: (count: number) => `Members (${count})`,
    colMember: 'Member',
    colStatus: 'Status',
  },
```

- [ ] **Step 3.2: Update `messages-ru.ts` `dashboard` block**

Open `src/shared/i18n/messages-ru.ts` and replace the `dashboard: { ... }` block (currently lines ~62–82) with:

```ts
  dashboard: {
    cashPot: 'Касса (наличные)',
    cardPot: 'Касса (карта)',
    movementsHeading: 'Движение средств',
    noMovements: 'За выбранный период ничего нет.',
    rangeClamped: (maxDays: number) => `Период сокращён до последних ${maxDays} дней.`,
    laneCashPot: 'Наличные',
    laneCardPot: 'Карта',
    youOwe: (name: string) => `${name} — Ваш долг`,
    youSettled: (name: string) => `${name} — Долгов нет`,
    teamSummary: 'Сводка по команде',
    potsLine: (cash: string, card: string) => `Наличные ${cash} · Карта ${card}`,
    membersHeading: (count: number) => `Участники (${count})`,
    colMember: 'Участник',
    colStatus: 'Статус',
  },
```

- [ ] **Step 3.3: Typecheck won't fully pass yet — that's expected**

The old keys (`activityHeading`, etc.) are still referenced by `dashboard/activity.tsx` and `dashboard/page.tsx`. Tasks 4 and 5 fix this. No commit yet — bundle this with Task 4 to keep main green.

---

## Task 4: `<MoneyHistory>` client component

**Files:**
- Create: `src/app/(app)/dashboard/money-history.tsx`

This is the grid + range picker + clamp notice. No unit tests; manual browser verification in Task 6.

- [ ] **Step 4.1: Create `src/app/(app)/dashboard/money-history.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeadingSmall } from 'baseui/typography';
import { DatePicker } from 'baseui/datepicker';
import { StatefulTooltip } from 'baseui/tooltip';
import { Tag } from 'baseui/tag';
import { useMessages } from '@/app/_i18n-provider';
import { Panel } from '@/ui/panel';
import { Muted } from '@/ui/text';
import { formatCents } from '@/shared/format';
import { eachDayBetween, isoDay, MAX_RANGE_DAYS } from '@/shared/date-range';
import type { Movement } from '@/server/domain/movements';

interface Props {
  movements: Movement[];
  range: { from: string; to: string };
  clamped: boolean;
}

type LaneKey = `member:${string}` | 'pot:cash' | 'pot:card';

interface Lane {
  key: LaneKey;
  label: string;
  kind: 'member' | 'pot';
}

export function MoneyHistory({ movements, range, clamped }: Props) {
  const m = useMessages();
  const router = useRouter();

  const days = useMemo(() => eachDayBetween(range.from, range.to), [range.from, range.to]);

  const memberLanes = useMemo<Lane[]>(() => {
    const totals = new Map<string, { name: string; total: number }>();
    for (const ev of movements) {
      if (ev.kind !== 'deposit') continue;
      const cur = totals.get(ev.payerUserId);
      if (cur) cur.total += ev.amount;
      else totals.set(ev.payerUserId, { name: ev.payerDisplayName, total: ev.amount });
    }
    return [...totals.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]): Lane => ({ key: `member:${id}`, label: v.name, kind: 'member' }));
  }, [movements]);

  const potLanes: Lane[] = [
    { key: 'pot:cash', label: m.dashboard.laneCashPot, kind: 'pot' },
    { key: 'pot:card', label: m.dashboard.laneCardPot, kind: 'pot' },
  ];

  const lanes = [...memberLanes, ...potLanes];

  // Cell index: laneKey + '|' + day -> Movement[]
  const cells = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const ev of movements) {
      const day = ev.at.slice(0, 10);
      const laneKey: LaneKey =
        ev.kind === 'deposit' ? `member:${ev.payerUserId}` : `pot:${ev.pot}`;
      const k = `${laneKey}|${day}`;
      const arr = map.get(k);
      if (arr) arr.push(ev);
      else map.set(k, [ev]);
    }
    return map;
  }, [movements]);

  // BaseWeb DatePicker (range) state — local mirror that we push to URL on change.
  const initial: Date[] = [
    new Date(`${range.from}T00:00:00.000Z`),
    new Date(`${range.to}T00:00:00.000Z`),
  ];
  const [pickerValue, setPickerValue] = useState<Date[]>(initial);

  function applyRange(next: (Date | null | undefined)[] | null | undefined) {
    if (!next || !next[0] || !next[1]) return;
    const from = isoDay(next[0]);
    const to = isoDay(next[1]);
    setPickerValue([next[0], next[1]]);
    router.push(`/dashboard?from=${from}&to=${to}`);
  }

  const todayIso = isoDay(new Date());

  return (
    <div style={{ marginTop: 16 }}>
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <HeadingSmall marginTop="0" marginBottom="0">{m.dashboard.movementsHeading}</HeadingSmall>
          <div style={{ minWidth: 280 }}>
            <DatePicker
              value={pickerValue}
              onChange={({ date }) => applyRange(Array.isArray(date) ? date : [date])}
              range
              quickSelect
              formatString="yyyy-MM-dd"
            />
          </div>
        </div>

        {clamped && (
          <Muted>{m.dashboard.rangeClamped(MAX_RANGE_DAYS)}</Muted>
        )}

        {movements.length === 0 && memberLanes.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Muted>{m.dashboard.noMovements}</Muted>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `minmax(120px, max-content) repeat(${days.length}, minmax(64px, 1fr))`,
                rowGap: 1,
                columnGap: 1,
                background: '#e5e7eb',
                minWidth: 'fit-content',
              }}
            >
              {/* Header row */}
              <div style={cellHeaderStickyBoth} />
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00.000Z`);
                const dow = dt.getUTCDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = d === todayIso;
                return (
                  <div
                    key={d}
                    style={{
                      ...cellHeaderTop,
                      color: isWeekend ? '#9ca3af' : '#374151',
                      background: isToday ? '#fef3c7' : '#f9fafb',
                    }}
                  >
                    {d.slice(5)}
                  </div>
                );
              })}

              {/* Lane rows */}
              {lanes.map((lane, idx) => {
                const isFirstPotRow = lane.kind === 'pot' && idx > 0 && lanes[idx - 1]?.kind === 'member';
                return (
                  <LaneRow
                    key={lane.key}
                    lane={lane}
                    days={days}
                    cells={cells}
                    drawDivider={isFirstPotRow}
                    todayIso={todayIso}
                  />
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function LaneRow({
  lane, days, cells, drawDivider, todayIso,
}: {
  lane: Lane;
  days: string[];
  cells: Map<string, Movement[]>;
  drawDivider: boolean;
  todayIso: string;
}) {
  return (
    <>
      <div
        style={{
          ...cellLaneLabel,
          fontWeight: lane.kind === 'pot' ? 600 : 500,
          color: lane.kind === 'pot' ? '#7c2d12' : '#111827',
          borderTop: drawDivider ? '2px solid #d1d5db' : 'none',
        }}
      >
        {lane.kind === 'pot' ? <PotBadge label={lane.label} /> : lane.label}
      </div>
      {days.map((d) => {
        const evs = cells.get(`${lane.key}|${d}`) ?? [];
        const dt = new Date(`${d}T00:00:00.000Z`);
        const dow = dt.getUTCDay();
        const isWeekend = dow === 0 || dow === 6;
        const isToday = d === todayIso;
        return (
          <div
            key={d}
            style={{
              ...cellBody,
              background: isToday ? '#fffbeb' : isWeekend ? '#fafafa' : '#ffffff',
              borderTop: drawDivider ? '2px solid #d1d5db' : 'none',
            }}
          >
            {evs.map((ev) => <EventCard key={`${ev.kind}-${ev.id}`} ev={ev} />)}
          </div>
        );
      })}
    </>
  );
}

function EventCard({ ev }: { ev: Movement }) {
  const tooltip = ev.kind === 'deposit' ? (ev.note ?? '') : ev.description;
  const sign = ev.kind === 'deposit' ? '+' : '−';
  const color = ev.kind === 'deposit' ? '#065f46' : '#991b1b';
  const bg = ev.kind === 'deposit' ? '#d1fae5' : '#fee2e2';
  return (
    <StatefulTooltip content={tooltip || null} showArrow>
      <div
        style={{
          fontSize: 12,
          padding: '2px 6px',
          borderRadius: 4,
          background: bg,
          color,
          whiteSpace: 'nowrap',
          cursor: 'default',
        }}
      >
        {sign}{formatCents(ev.amount).replace(/^-/, '')}
      </div>
    </StatefulTooltip>
  );
}

function PotBadge({ label }: { label: string }) {
  return <Tag closeable={false} kind="warning" variant="solid">{label}</Tag>;
}

const cellHeaderStickyBoth: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  top: 0,
  background: '#f3f4f6',
  zIndex: 3,
  padding: '6px 10px',
};

const cellHeaderTop: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  padding: '6px 8px',
  fontSize: 12,
  textAlign: 'center',
};

const cellLaneLabel: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: '#f9fafb',
  zIndex: 1,
  padding: '6px 10px',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
};

const cellBody: React.CSSProperties = {
  padding: 4,
  minHeight: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};
```

Notes for the implementer:
- `formatCents` already prefixes `-` for negatives, but our `ev.amount` is always positive (DB guarantee). We add the sign manually based on `kind`.
- The `Tag` import from `baseui/tag` is used for the pot badge. `closeable={false}` suppresses the X.
- `quickSelect` on `DatePicker` adds presets ("Last 7 days", etc.) — useful UX, doesn't conflict with our URL-driven state.

- [ ] **Step 4.2: Commit (typecheck still fails — page.tsx is next)**

```bash
git add src/app/(app)/dashboard/money-history.tsx \
        src/shared/i18n/messages-en.ts \
        src/shared/i18n/messages-ru.ts
git commit -m "feat(dashboard): MoneyHistory grid component and i18n keys"
```

---

## Task 5: Wire into dashboard page, remove old activity feed

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Delete: `src/app/(app)/dashboard/activity.tsx`
- Delete: `src/server/domain/activity.ts`
- Delete: `tests/domain/activity.test.ts`

- [ ] **Step 5.1: Rewrite `src/app/(app)/dashboard/page.tsx`**

Replace the file with:

```tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { listMoneyMovements } from '@/server/domain/movements';
import { resolveDashboardRange } from '@/shared/date-range';
import { formatCents } from '@/shared/format';
import { getMessages } from '@/shared/i18n';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { Panel } from '@/ui/panel';
import { StatusCard } from '@/ui/status-card';
import { SectionHeading } from '@/ui/heading';
import { Muted } from '@/ui/text';
import { PotCard } from './pot-card';
import { MoneyHistory } from './money-history';
import { MembersTable, type MemberRow } from '../members/members-table';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  if (user.role === 'admin') {
    const range = resolveDashboardRange({ from: searchParams.from, to: searchParams.to });
    const [pots, members, movements] = await Promise.all([
      getPotBalances(db),
      listActiveMembers(db),
      listMoneyMovements(db, { from: range.from, to: range.to }),
    ]);
    const debts = await Promise.all(members.map((mm) => getMemberOutstandingDebt(db, mm.id)));

    const memberRows: MemberRow[] = members.map((mm, i) => {
      const debt = debts[i] ?? 0;
      return {
        id: mm.id,
        displayName: mm.displayName,
        role: mm.role as 'admin' | 'member',
        isActive: true,
        debtFormatted: debt > 0 ? formatCents(debt) : null,
      };
    });

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <PotCard label={m.dashboard.cashPot} cents={pots.cash} />
          <PotCard label={m.dashboard.cardPot} cents={pots.card} />
        </div>
        <Panel>
          <SectionHeading>{m.dashboard.membersHeading(members.length)}</SectionHeading>
          <MembersTable rows={memberRows} />
        </Panel>
        <MoneyHistory
          movements={movements}
          range={{ from: range.from, to: range.to }}
          clamped={range.clamped}
        />
      </div>
    );
  }

  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);
  return (
    <div>
      <StatusCard
        tone={debt > 0 ? 'negative' : 'positive'}
        caption={debt > 0 ? m.dashboard.youOwe(user.displayName) : m.dashboard.youSettled(user.displayName)}
        value={formatCents(debt)}
      />
      <Panel>
        <SectionHeading>{m.dashboard.teamSummary}</SectionHeading>
        <Muted>
          {m.dashboard.potsLine(formatCents(pots.cash), formatCents(pots.card))}
        </Muted>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 5.2: Verify no other consumer of the old `recentActivity`**

Run: `grep -rn "recentActivity\|ActivityFeed\|ActivityRow" src tests`
Expected: no matches outside `src/server/domain/activity.ts`, `src/app/(app)/dashboard/activity.tsx`, `tests/domain/activity.test.ts` (the files we delete next).

If anything else references them, stop and add cleanup to this task.

- [ ] **Step 5.3: Delete the obsolete files**

```bash
git rm src/app/(app)/dashboard/activity.tsx \
       src/server/domain/activity.ts \
       tests/domain/activity.test.ts
```

- [ ] **Step 5.4: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 5.5: Run full test suite**

Run: `pnpm vitest run`
Expected: PASS (the deleted `recentActivity` test is gone; everything else stays green).

- [ ] **Step 5.6: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "feat(dashboard): swap activity feed for MoneyHistory; drop recentActivity"
```

---

## Task 6: Manual browser verification

**Files:** none (verification only)

Tasks 1–5 produce a passing build and green tests, but a UI feature needs a real browser check. The dev server is `pnpm dev` (Next.js).

- [ ] **Step 6.1: Start the dev server**

Run: `pnpm dev`
Expected: server starts, listens on a port (usually 3000), no compile errors in stdout.

- [ ] **Step 6.2: Smoke-check the dashboard as admin**

Open `http://localhost:3000/dashboard` in a browser, signed in as an admin user.

Verify (and screenshot for the PR):
- The pot cards and Members panel still render exactly as before.
- A new "Money flow" panel sits where the activity feed used to be.
- The date range picker shows the current calendar month (1st → today).
- If there are deposits/spendings in the current month, lanes appear: one per depositing member at the top (sorted by total deposit volume), then a divider, then `Cash` and `Card` pot rows at the bottom.
- Withdrawal cards are red; deposit cards are green.
- Hovering a card shows the note/description in a tooltip.
- Today's column is highlighted; weekend columns are visually muted.
- The grid scrolls horizontally if the viewport is narrower than the day count.

- [ ] **Step 6.3: Smoke-check the date picker**

Change the picker to a wider range (e.g. start of year → today). Confirm:
- URL updates to `?from=YYYY-01-01&to=YYYY-MM-DD`.
- A muted "Range narrowed to last 90 days." notice appears.
- Grid only shows the last 90 days.

Pick a range with no data. Confirm:
- Grid collapses to just the two pot rows; no member rows.
- The "Nothing in this period." message appears centered (this happens when both `movements.length === 0` AND `memberLanes.length === 0`).

- [ ] **Step 6.4: Smoke-check as a non-admin member**

Sign in as a regular member (or impersonate via test setup). Open `/dashboard`. Confirm the member view is unchanged: debt status card + team summary panel, no money-flow grid.

- [ ] **Step 6.5: Final commit (if any tweaks were needed)**

If Step 6.2/6.3 surfaced visual bugs, fix in-place and commit:

```bash
git add -A
git commit -m "fix(dashboard): polish MoneyHistory grid based on browser smoke-check"
```

If no tweaks are needed, no commit. Done.

---

## Self-Review Checklist

Spec coverage walked back through the design doc:

- "Replace activity feed with money-flow grid" → Tasks 4 + 5 ✓
- "Per-member deposit lanes, sorted by volume, hide-inactive" → Task 4 (`memberLanes` memo) ✓
- "Two pot lanes always shown" → Task 4 (`potLanes`) ✓
- "Day columns from `from` to `to`" → Task 4 (`days` memo using `eachDayBetween`) ✓
- "Event cards stack in cells, signed amount, color" → Task 4 (`EventCard`) ✓
- "Tooltip on cards with note/description" → Task 4 (`StatefulTooltip`) ✓
- "Sticky lane labels and date header" → Task 4 (CSS `position: sticky`) ✓
- "Default = current calendar month" → Task 2 (`resolveDashboardRange` default + tests) ✓
- "Clamp to 90 days with notice" → Task 2 + Task 4 (`rangeClamped` notice) ✓
- "Cancelled rows excluded" → Task 1 (test + `isNull(cancelledAt)`) ✓
- "URL query state for range" → Task 4 (`router.push`) + Task 5 (`searchParams`) ✓
- "Non-admin view unchanged" → Task 5 (the `else` branch of `page.tsx` is untouched) ✓
- "Today highlighted, weekends muted" → Task 4 (column styling) ✓

Type consistency: `Movement` is defined in Task 1 and imported by Task 4. `ResolvedRange.from/to/clamped` defined in Task 2 and used by Task 4 + Task 5. i18n key signatures (`rangeClamped(n: number) => string`) are stable across Task 3 and consumed in Task 4.

No placeholders: every code step has full code; every command has expected output.
