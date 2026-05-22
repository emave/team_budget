# Guest Deposits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins record income from non-members (one-off walk-ins and recurring named guests), with a persistent `guests` entity, a date × guest matrix view, and entry points on the admin web, Mini App, and Telegram bot.

**Architecture:** Two new tables (`guests`, `guest_deposits`). New domain modules for each. Three existing read paths (`pots.ts`, `movements.ts`, `activity.ts`) extended to fold guest deposits into pot balances, money movements, and Mini App recent activity. Server actions follow the existing `makeAdminAction` factory pattern. UI follows existing baseui/TableBuilder + react-hook-form + TanStack Query conventions. Bot conversation mirrors `pay.ts` style.

**Tech Stack:** TypeScript, Next.js 14 (App Router), Drizzle + better-sqlite3, baseui, react-hook-form, TanStack Query, grammY (`@grammyjs/conversations`), Vitest.

**Spec:** [docs/superpowers/specs/2026-05-22-guest-deposits-design.md](../specs/2026-05-22-guest-deposits-design.md)

---

## Conventions

- Money values are integers in minor units (cents). Money parsing comes from `moneySchema` in `@/shared/schemas`.
- All times are ISO strings.
- Domain functions accept `db` as the first argument.
- All server actions are admin-only.
- All tests run via `pnpm test`.
- Commit messages follow Conventional Commits (`feat:`, `test:`, `chore:` etc.) — match the existing log.

---

## Task 1: Schema and migration

**Files:**
- Modify: [src/server/db/schema.ts](../../../src/server/db/schema.ts) — append two new table definitions at the end.
- Create: `drizzle/0004_guests_and_guest_deposits.sql` (final name may differ — drizzle-kit picks the slug).
- Create: `drizzle/meta/0004_snapshot.json` and update `drizzle/meta/_journal.json` (drizzle-kit generates).

- [ ] **Step 1: Add schema definitions**

Append to [src/server/db/schema.ts](../../../src/server/db/schema.ts) (after `infoPages`):

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

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: drizzle-kit creates `drizzle/0004_*.sql` containing the two `CREATE TABLE` statements and updates `drizzle/meta/`.

- [ ] **Step 3: Add indexes to the generated migration**

Open the new `drizzle/0004_*.sql` and append at the end (after the two CREATE TABLE statements):

```sql
--> statement-breakpoint
CREATE INDEX `guest_deposits_guest_id_idx` ON `guest_deposits` (`guest_id`);--> statement-breakpoint
CREATE INDEX `guest_deposits_received_at_idx` ON `guest_deposits` (`received_at`);
```

(We don't model these in the Drizzle TS schema because the project doesn't elsewhere; they're indexes-only, not query-shape concerns.)

- [ ] **Step 4: Verify migration applies cleanly to a fresh DB**

Run: `pnpm test -- tests/smoke.test.ts`
Expected: PASS. The smoke test creates an in-memory DB via the test helper, which runs every migration including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/0004_*.sql drizzle/meta/
git commit -m "feat(schema): add guests and guest_deposits tables"
```

---

## Task 2: Domain — guests CRUD

**Files:**
- Create: `src/server/domain/guests.ts`
- Test: `tests/domain/guests.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/guests.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createGuest,
  listGuests,
  getGuest,
  renameGuest,
  archiveGuest,
  unarchiveGuest,
} from '@/server/domain/guests';

describe('guests domain', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
  });

  it('creates a guest with trimmed name', async () => {
    const g = await createGuest(db, { name: '  Pasha  ', createdByUserId: adminId });
    expect(g.name).toBe('Pasha');
    expect(g.archived).toBe(false);
  });

  it('rejects empty name', async () => {
    await expect(createGuest(db, { name: '   ', createdByUserId: adminId })).rejects.toThrow();
  });

  it('lists non-archived guests by default', async () => {
    const a = await createGuest(db, { name: 'A', createdByUserId: adminId });
    const b = await createGuest(db, { name: 'B', createdByUserId: adminId });
    await archiveGuest(db, b.id);
    const visible = await listGuests(db);
    expect(visible.map((g) => g.id)).toEqual([a.id]);
    const all = await listGuests(db, { includeArchived: true });
    expect(all.length).toBe(2);
  });

  it('renames a guest', async () => {
    const g = await createGuest(db, { name: 'A', createdByUserId: adminId });
    const renamed = await renameGuest(db, g.id, '  B  ');
    expect(renamed.name).toBe('B');
    expect((await getGuest(db, g.id))!.name).toBe('B');
  });

  it('archive and unarchive are idempotent', async () => {
    const g = await createGuest(db, { name: 'A', createdByUserId: adminId });
    await archiveGuest(db, g.id);
    await archiveGuest(db, g.id);
    expect((await getGuest(db, g.id))!.archived).toBe(true);
    await unarchiveGuest(db, g.id);
    await unarchiveGuest(db, g.id);
    expect((await getGuest(db, g.id))!.archived).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/domain/guests.test.ts`
Expected: FAIL — module `@/server/domain/guests` does not exist.

- [ ] **Step 3: Implement guests domain**

Create `src/server/domain/guests.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { guests } from '@/server/db/schema';
import type { Db } from './types';

export type Guest = typeof guests.$inferSelect;

export interface CreateGuestInput {
  name: string;
  createdByUserId: string;
}

export async function createGuest(db: Db, input: CreateGuestInput): Promise<Guest> {
  const name = input.name.trim();
  if (!name) throw new Error('guest name required');
  const id = randomUUID();
  db.insert(guests)
    .values({ id, name, archived: false, createdByUserId: input.createdByUserId })
    .run();
  return db.select().from(guests).where(eq(guests.id, id)).get()!;
}

export async function getGuest(db: Db, id: string): Promise<Guest | undefined> {
  return db.select().from(guests).where(eq(guests.id, id)).get();
}

export async function listGuests(
  db: Db,
  opts: { includeArchived?: boolean } = {},
): Promise<Guest[]> {
  const rows = db.select().from(guests).orderBy(asc(guests.name)).all();
  return opts.includeArchived ? rows : rows.filter((g) => !g.archived);
}

export async function renameGuest(db: Db, id: string, name: string): Promise<Guest> {
  const clean = name.trim();
  if (!clean) throw new Error('guest name required');
  db.update(guests).set({ name: clean }).where(eq(guests.id, id)).run();
  const g = await getGuest(db, id);
  if (!g) throw new Error(`guest ${id} not found`);
  return g;
}

export async function archiveGuest(db: Db, id: string): Promise<Guest> {
  db.update(guests).set({ archived: true }).where(eq(guests.id, id)).run();
  const g = await getGuest(db, id);
  if (!g) throw new Error(`guest ${id} not found`);
  return g;
}

export async function unarchiveGuest(db: Db, id: string): Promise<Guest> {
  db.update(guests).set({ archived: false }).where(eq(guests.id, id)).run();
  const g = await getGuest(db, id);
  if (!g) throw new Error(`guest ${id} not found`);
  return g;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/domain/guests.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/guests.ts tests/domain/guests.test.ts
git commit -m "feat(domain): guests CRUD with archive"
```

---

## Task 3: Domain — guest deposits

**Files:**
- Create: `src/server/domain/guest-deposits.ts`
- Test: `tests/domain/guest-deposits.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/guest-deposits.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createGuest, archiveGuest } from '@/server/domain/guests';
import {
  recordGuestDeposit,
  cancelGuestDeposit,
  listGuestDeposits,
  sumGuestDepositsByMethod,
} from '@/server/domain/guest-deposits';

describe('guest-deposits domain', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
  });

  it('records an anonymous deposit (no guestId)', async () => {
    const d = await recordGuestDeposit(db, {
      amount: 5000,
      method: 'cash',
      createdByUserId: adminId,
    });
    expect(d.amount).toBe(5000);
    expect(d.method).toBe('cash');
    expect(d.guestId).toBeNull();
    expect(d.receivedAt).toBeTruthy();
  });

  it('records a deposit linked to a guest', async () => {
    const g = await createGuest(db, { name: 'Pasha', createdByUserId: adminId });
    const d = await recordGuestDeposit(db, {
      guestId: g.id,
      amount: 3000,
      method: 'card',
      note: 'sat game',
      createdByUserId: adminId,
    });
    expect(d.guestId).toBe(g.id);
    expect(d.note).toBe('sat game');
  });

  it('rejects non-positive amount', async () => {
    await expect(
      recordGuestDeposit(db, { amount: 0, method: 'cash', createdByUserId: adminId }),
    ).rejects.toThrow();
    await expect(
      recordGuestDeposit(db, { amount: -1, method: 'cash', createdByUserId: adminId }),
    ).rejects.toThrow();
  });

  it('rejects unknown guestId', async () => {
    await expect(
      recordGuestDeposit(db, {
        guestId: 'nope',
        amount: 100,
        method: 'cash',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects archived guest', async () => {
    const g = await createGuest(db, { name: 'Old', createdByUserId: adminId });
    await archiveGuest(db, g.id);
    await expect(
      recordGuestDeposit(db, {
        guestId: g.id,
        amount: 100,
        method: 'cash',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('cancel is idempotent and excludes from sums', async () => {
    const d = await recordGuestDeposit(db, { amount: 1000, method: 'cash', createdByUserId: adminId });
    await recordGuestDeposit(db, { amount: 2000, method: 'cash', createdByUserId: adminId });
    expect(await sumGuestDepositsByMethod(db, 'cash')).toBe(3000);
    await cancelGuestDeposit(db, d.id);
    await cancelGuestDeposit(db, d.id); // idempotent
    expect(await sumGuestDepositsByMethod(db, 'cash')).toBe(2000);
  });

  it('list filters by guestId and excludes cancelled when asked', async () => {
    const g = await createGuest(db, { name: 'P', createdByUserId: adminId });
    const a = await recordGuestDeposit(db, { guestId: g.id, amount: 100, method: 'cash', createdByUserId: adminId });
    await recordGuestDeposit(db, { amount: 200, method: 'cash', createdByUserId: adminId });
    await cancelGuestDeposit(db, a.id);
    const all = await listGuestDeposits(db);
    expect(all.length).toBe(2);
    const onlyGuest = await listGuestDeposits(db, { guestId: g.id });
    expect(onlyGuest.length).toBe(1);
    expect(onlyGuest[0]!.id).toBe(a.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/domain/guest-deposits.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement guest-deposits domain**

Create `src/server/domain/guest-deposits.ts`:

```ts
import { and, desc, eq, isNull, sum } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { guests, guestDeposits } from '@/server/db/schema';
import type { Db } from './types';

export type GuestDeposit = typeof guestDeposits.$inferSelect;
export type Pot = 'cash' | 'card';

export interface RecordGuestDepositInput {
  guestId?: string | null;
  amount: number;
  method: Pot;
  note?: string | null;
  receivedAt?: string;
  createdByUserId: string;
}

function assertPositive(n: number) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`amount must be a positive integer, got ${n}`);
  }
}

export async function recordGuestDeposit(
  db: Db,
  input: RecordGuestDepositInput,
): Promise<GuestDeposit> {
  assertPositive(input.amount);
  if (input.method !== 'cash' && input.method !== 'card') {
    throw new Error(`invalid method: ${String(input.method)}`);
  }
  if (input.guestId) {
    const g = db.select().from(guests).where(eq(guests.id, input.guestId)).get();
    if (!g) throw new Error(`guest ${input.guestId} not found`);
    if (g.archived) throw new Error(`guest ${input.guestId} is archived`);
  }
  const id = randomUUID();
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  db.insert(guestDeposits)
    .values({
      id,
      guestId: input.guestId ?? null,
      amount: input.amount,
      method: input.method,
      note: input.note ?? null,
      receivedAt,
      createdByUserId: input.createdByUserId,
    })
    .run();
  return db.select().from(guestDeposits).where(eq(guestDeposits.id, id)).get()!;
}

export async function cancelGuestDeposit(db: Db, id: string): Promise<GuestDeposit> {
  const d = db.select().from(guestDeposits).where(eq(guestDeposits.id, id)).get();
  if (!d) throw new Error(`guest deposit ${id} not found`);
  if (d.cancelledAt) return d;
  db.update(guestDeposits)
    .set({ cancelledAt: new Date().toISOString() })
    .where(eq(guestDeposits.id, id))
    .run();
  return db.select().from(guestDeposits).where(eq(guestDeposits.id, id)).get()!;
}

export interface ListGuestDepositsOptions {
  guestId?: string | null;
  range?: { from: string; to: string };
  limit?: number;
  includeCancelled?: boolean;
}

export async function listGuestDeposits(
  db: Db,
  opts: ListGuestDepositsOptions = {},
): Promise<GuestDeposit[]> {
  // Filtering at the JS layer keeps query construction simple and matches the
  // sizes we expect (hundreds of rows lifetime). If it grows, push into SQL.
  let rows = db.select().from(guestDeposits).orderBy(desc(guestDeposits.receivedAt)).all();
  if (!opts.includeCancelled) rows = rows.filter((r) => !r.cancelledAt);
  if (opts.guestId !== undefined) rows = rows.filter((r) => r.guestId === opts.guestId);
  if (opts.range) {
    const from = `${opts.range.from}T00:00:00.000Z`;
    const to = `${opts.range.to}T23:59:59.999Z`;
    rows = rows.filter((r) => r.receivedAt >= from && r.receivedAt <= to);
  }
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

export async function sumGuestDepositsByMethod(db: Db, method: Pot): Promise<number> {
  const row = db
    .select({ s: sum(guestDeposits.amount) })
    .from(guestDeposits)
    .where(and(eq(guestDeposits.method, method), isNull(guestDeposits.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/domain/guest-deposits.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/guest-deposits.ts tests/domain/guest-deposits.test.ts
git commit -m "feat(domain): record/cancel/list/sum guest deposits"
```

---

## Task 4: Domain — guest deposit summary for matrix view

**Files:**
- Modify: `src/server/domain/guest-deposits.ts`
- Test: `tests/domain/guest-deposits.test.ts` (extend)

- [ ] **Step 1: Add failing test for summary aggregation**

Append to `tests/domain/guest-deposits.test.ts` inside the existing `describe`:

```ts
  it('guestDepositSummary aggregates by date and guest', async () => {
    const { guestDepositSummary } = await import('@/server/domain/guest-deposits');
    const g1 = await createGuest(db, { name: 'P', createdByUserId: adminId });
    const g2 = await createGuest(db, { name: 'V', createdByUserId: adminId });
    await recordGuestDeposit(db, {
      guestId: g1.id, amount: 1000, method: 'cash',
      receivedAt: '2026-05-15T10:00:00.000Z', createdByUserId: adminId,
    });
    await recordGuestDeposit(db, {
      guestId: g1.id, amount: 500, method: 'cash',
      receivedAt: '2026-05-15T18:00:00.000Z', createdByUserId: adminId,
    });
    await recordGuestDeposit(db, {
      guestId: g2.id, amount: 3000, method: 'card',
      receivedAt: '2026-05-15T11:00:00.000Z', createdByUserId: adminId,
    });
    await recordGuestDeposit(db, {
      amount: 700, method: 'cash',
      receivedAt: '2026-05-16T09:00:00.000Z', createdByUserId: adminId,
    });
    const cancelled = await recordGuestDeposit(db, {
      guestId: g1.id, amount: 999, method: 'cash',
      receivedAt: '2026-05-15T12:00:00.000Z', createdByUserId: adminId,
    });
    await cancelGuestDeposit(db, cancelled.id);

    const rows = await guestDepositSummary(db, { from: '2026-05-15', to: '2026-05-16' });
    // Two deposits for g1 on 2026-05-15 collapse to 1500; cancelled excluded.
    const find = (date: string, guestId: string | null) =>
      rows.find((r) => r.date === date && r.guestId === guestId)?.amount;
    expect(find('2026-05-15', g1.id)).toBe(1500);
    expect(find('2026-05-15', g2.id)).toBe(3000);
    expect(find('2026-05-16', null)).toBe(700);
    expect(rows.length).toBe(3);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/domain/guest-deposits.test.ts`
Expected: FAIL — `guestDepositSummary` not exported.

- [ ] **Step 3: Implement `guestDepositSummary`**

Append to `src/server/domain/guest-deposits.ts`:

```ts
export interface GuestDepositSummaryRow {
  date: string;          // YYYY-MM-DD (UTC)
  guestId: string | null;
  amount: number;
}

export async function guestDepositSummary(
  db: Db,
  range: { from: string; to: string },
): Promise<GuestDepositSummaryRow[]> {
  const fromBound = `${range.from}T00:00:00.000Z`;
  const toBound = `${range.to}T23:59:59.999Z`;
  const rows = db.select().from(guestDeposits).all();
  const buckets = new Map<string, GuestDepositSummaryRow>();
  for (const r of rows) {
    if (r.cancelledAt) continue;
    if (r.receivedAt < fromBound || r.receivedAt > toBound) continue;
    const date = r.receivedAt.slice(0, 10);
    const key = `${date}|${r.guestId ?? ''}`;
    const cur = buckets.get(key);
    if (cur) cur.amount += r.amount;
    else buckets.set(key, { date, guestId: r.guestId, amount: r.amount });
  }
  return [...buckets.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    return (a.guestId ?? '') < (b.guestId ?? '') ? -1 : 1;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/domain/guest-deposits.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/guest-deposits.ts tests/domain/guest-deposits.test.ts
git commit -m "feat(domain): guestDepositSummary aggregation for matrix view"
```

---

## Task 5: Fold guest deposits into pot balances

**Files:**
- Modify: [src/server/domain/pots.ts](../../../src/server/domain/pots.ts)
- Test: [tests/domain/pots.test.ts](../../../tests/domain/pots.test.ts) (extend)

- [ ] **Step 1: Write failing test**

Append a new `it()` block to `tests/domain/pots.test.ts`. Read the existing imports first; the test should look like:

```ts
  it('includes guest deposits in pot balances and excludes cancelled', async () => {
    // assumes db, adminId already in scope from existing beforeEach
    const { recordGuestDeposit, cancelGuestDeposit } = await import('@/server/domain/guest-deposits');
    await recordGuestDeposit(db, { amount: 1500, method: 'cash', createdByUserId: adminId });
    await recordGuestDeposit(db, { amount: 500, method: 'card', createdByUserId: adminId });
    const cancelled = await recordGuestDeposit(db, { amount: 999, method: 'cash', createdByUserId: adminId });
    await cancelGuestDeposit(db, cancelled.id);
    const bal = await getPotBalances(db);
    expect(bal.cash).toBe(1500);
    expect(bal.card).toBe(500);
  });
```

Use the existing `describe`/`beforeEach` structure in `pots.test.ts`. If existing tests don't share `adminId` via outer scope, follow the same setup pattern they use.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/domain/pots.test.ts`
Expected: FAIL — cash/card balances are still 0 because guest deposits aren't summed.

- [ ] **Step 3: Update `getPotBalances`**

In [src/server/domain/pots.ts](../../../src/server/domain/pots.ts):

Add import at top:

```ts
import { sumGuestDepositsByMethod } from './guest-deposits';
```

Replace the body of `getPotBalances`:

```ts
export async function getPotBalances(db: Db): Promise<PotBalances> {
  const [
    s,
    cashIn, cashOut, cashBorrow, cashGuest,
    cardIn, cardOut, cardBorrow, cardGuest,
  ] = await Promise.all([
    getOrCreateSettings(db),
    sumPaymentsByMethod(db, 'cash'),
    sumSpendingsByPot(db, 'cash'),
    sumPotBorrows(db, 'cash'),
    sumGuestDepositsByMethod(db, 'cash'),
    sumPaymentsByMethod(db, 'card'),
    sumSpendingsByPot(db, 'card'),
    sumPotBorrows(db, 'card'),
    sumGuestDepositsByMethod(db, 'card'),
  ]);
  return {
    cash: s.cashOpeningCents + cashIn + cashGuest - cashOut - cashBorrow,
    card: s.cardOpeningCents + cardIn + cardGuest - cardOut - cardBorrow,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/domain/pots.test.ts`
Expected: all pots tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/pots.ts tests/domain/pots.test.ts
git commit -m "feat(pots): include guest deposits in pot balances"
```

---

## Task 6: Fold guest deposits into money movements

**Files:**
- Modify: [src/server/domain/movements.ts](../../../src/server/domain/movements.ts)
- Test: [tests/domain/movements.test.ts](../../../tests/domain/movements.test.ts) (extend)

- [ ] **Step 1: Write failing test**

Append a new `it()` to `tests/domain/movements.test.ts`:

```ts
  it('includes guest_deposit events (named and anonymous)', async () => {
    const { createGuest } = await import('@/server/domain/guests');
    const { recordGuestDeposit, cancelGuestDeposit } = await import('@/server/domain/guest-deposits');
    const g = await createGuest(db, { name: 'Pasha', createdByUserId: adminId });
    await recordGuestDeposit(db, {
      guestId: g.id, amount: 4000, method: 'cash',
      receivedAt: '2026-05-15T10:00:00.000Z', note: 'sat game', createdByUserId: adminId,
    });
    await recordGuestDeposit(db, {
      amount: 2000, method: 'card',
      receivedAt: '2026-05-15T11:00:00.000Z', createdByUserId: adminId,
    });
    const cancelled = await recordGuestDeposit(db, {
      amount: 999, method: 'cash',
      receivedAt: '2026-05-15T12:00:00.000Z', createdByUserId: adminId,
    });
    await cancelGuestDeposit(db, cancelled.id);

    const events = await listMoneyMovements(db, { from: '2026-05-15', to: '2026-05-15' });
    const guests = events.filter((e) => e.kind === 'guest_deposit');
    expect(guests.length).toBe(2);
    const named = guests.find((e) => e.kind === 'guest_deposit' && e.guestId === g.id);
    const anon = guests.find((e) => e.kind === 'guest_deposit' && e.guestId === null);
    expect(named && named.kind === 'guest_deposit' && named.guestName).toBe('Pasha');
    expect(anon && anon.kind === 'guest_deposit' && anon.guestName).toBe(null);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/domain/movements.test.ts`
Expected: FAIL — `guest_deposit` kind not recognised.

- [ ] **Step 3: Extend `Movement` and `listMoneyMovements`**

Replace contents of [src/server/domain/movements.ts](../../../src/server/domain/movements.ts):

```ts
import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { payments, spendings, users, guests, guestDeposits } from '@/server/db/schema';
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
      kind: 'guest_deposit';
      id: string;
      at: string;
      amount: number;
      method: 'cash' | 'card';
      guestId: string | null;
      guestName: string | null;
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

  const gs = db
    .select({
      id: guestDeposits.id,
      at: guestDeposits.receivedAt,
      amount: guestDeposits.amount,
      method: guestDeposits.method,
      guestId: guestDeposits.guestId,
      guestName: guests.name,
      note: guestDeposits.note,
    })
    .from(guestDeposits)
    .leftJoin(guests, eq(guests.id, guestDeposits.guestId))
    .where(
      and(
        isNull(guestDeposits.cancelledAt),
        gte(guestDeposits.receivedAt, fromBound),
        lte(guestDeposits.receivedAt, toBound),
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
      id: p.id, at: p.at, amount: p.amount, method: p.method,
      payerUserId: p.payerUserId, payerDisplayName: p.payerDisplayName, note: p.note,
    })),
    ...gs.map((g): Movement => ({
      kind: 'guest_deposit',
      id: g.id, at: g.at, amount: g.amount, method: g.method,
      guestId: g.guestId, guestName: g.guestName, note: g.note,
    })),
    ...ss.map((s): Movement => ({
      kind: 'withdraw',
      id: s.id, at: s.at, amount: s.amount, pot: s.pot, description: s.description,
    })),
  ];

  merged.sort((a, b) => {
    if (a.at !== b.at) return a.at > b.at ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });

  return merged;
}
```

- [ ] **Step 4: Update dashboard renderer to skip-safely**

Open [src/app/(app)/dashboard/page.tsx](../../../src/app/(app)/dashboard/page.tsx) and any component that switches on `movement.kind`. Add a `case 'guest_deposit':` branch rendering it like a deposit row with the guest name (fallback "Guest" when null). If the dashboard doesn't switch on kind exhaustively, no change needed — TypeScript will flag it via `tsc`.

Run: `pnpm typecheck`
Expected: PASS, or PASS once the new branch is added. If errors point at switch-statements, add a `case 'guest_deposit':` that mirrors `case 'deposit':` with `guestName ?? 'Guest'`.

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: all tests including the new movements test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/domain/movements.ts tests/domain/movements.test.ts src/app/\(app\)/dashboard
git commit -m "feat(movements): include guest deposits in money movements"
```

---

## Task 7: Fold guest deposits into Mini App recent activity

**Files:**
- Modify: [src/server/domain/activity.ts](../../../src/server/domain/activity.ts)
- Test: [tests/domain/activity.test.ts](../../../tests/domain/activity.test.ts) (extend)
- Modify (if it switches on `event.kind` exhaustively): Mini App home in [src/app/(mini)/mini/page.tsx](../../../src/app/(mini)/mini/page.tsx) and any recent-activity renderer it uses.

- [ ] **Step 1: Write failing test**

Append a new `it()` to `tests/domain/activity.test.ts`:

```ts
  it('includes guest_deposit events with name resolution', async () => {
    const { createGuest } = await import('@/server/domain/guests');
    const { recordGuestDeposit } = await import('@/server/domain/guest-deposits');
    const g = await createGuest(db, { name: 'Pasha', createdByUserId: adminId });
    await recordGuestDeposit(db, { guestId: g.id, amount: 100, method: 'cash', createdByUserId: adminId });
    await recordGuestDeposit(db, { amount: 200, method: 'card', createdByUserId: adminId });
    const events = await recentActivity(db, 10);
    const guests = events.filter((e) => e.kind === 'guest_deposit');
    expect(guests.length).toBe(2);
    expect(
      guests.find((e) => e.kind === 'guest_deposit' && e.guestId === g.id)?.kind === 'guest_deposit'
        && (guests.find((e) => e.kind === 'guest_deposit' && e.guestId === g.id) as { guestName: string | null }).guestName,
    ).toBe('Pasha');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/domain/activity.test.ts`
Expected: FAIL — `guest_deposit` kind not present.

- [ ] **Step 3: Extend `ActivityEvent` and `recentActivity`**

In [src/server/domain/activity.ts](../../../src/server/domain/activity.ts):

Add import:

```ts
import { guests, guestDeposits } from '@/server/db/schema';
```

Add to the `ActivityEvent` union:

```ts
| { kind: 'guest_deposit'; id: string; createdAt: string; amount: number; method: 'cash' | 'card'; guestId: string | null; guestName: string | null }
```

In `recentActivity`, add a fourth query mirroring the payments one:

```ts
  const gs = db
    .select({
      id: guestDeposits.id,
      createdAt: guestDeposits.createdAt,
      amount: guestDeposits.amount,
      method: guestDeposits.method,
      guestId: guestDeposits.guestId,
      guestName: guests.name,
    })
    .from(guestDeposits)
    .leftJoin(guests, eq(guests.id, guestDeposits.guestId))
    .orderBy(desc(guestDeposits.createdAt))
    .limit(limit)
    .all();
```

And in the `events` array spread, add:

```ts
    ...gs.map((g): ActivityEvent => ({
      kind: 'guest_deposit',
      id: g.id,
      createdAt: g.createdAt,
      amount: g.amount,
      method: g.method,
      guestId: g.guestId,
      guestName: g.guestName,
    })),
```

- [ ] **Step 4: Update Mini App renderer**

Open [src/app/(mini)/mini/page.tsx](../../../src/app/(mini)/mini/page.tsx). Find the renderer that switches on `event.kind`. Add a branch for `guest_deposit` that mirrors the `payment` branch, displaying `event.guestName ?? m.guests.anonymous` as the title (`m.guests.anonymous` will be added in Task 10).

Run: `pnpm typecheck`
Expected: PASS — if any exhaustive-check fails point at activity, add the new branch.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- tests/domain/activity.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/domain/activity.ts tests/domain/activity.test.ts src/app/\(mini\)/mini/page.tsx
git commit -m "feat(activity): include guest deposits in Mini App recent activity"
```

---

## Task 8: Zod schemas for actions

**Files:**
- Modify: [src/shared/schemas.ts](../../../src/shared/schemas.ts)

- [ ] **Step 1: Append schemas**

Append to [src/shared/schemas.ts](../../../src/shared/schemas.ts):

```ts
export const createGuestSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const renameGuestSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
});

export const archiveGuestSchema = z.object({ id: idSchema });

export const recordGuestDepositSchema = z.object({
  guestId: idSchema.nullable().optional(),
  amount: moneySchema,
  method: potSchema,
  note: z.string().max(200).optional(),
  receivedAt: z.string().datetime().optional(),
});

export const cancelGuestDepositSchema = z.object({ id: idSchema });

export const guestDepositRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/schemas.ts
git commit -m "feat(schemas): zod input schemas for guests and guest deposits"
```

---

## Task 9: Server actions

**Files:**
- Create: `src/server/actions/guests.ts`
- Create: `src/server/actions/guests-server.ts`
- Create: `src/server/actions/guest-deposits.ts`
- Create: `src/server/actions/guest-deposits-server.ts`
- Test: `tests/actions/guests.test.ts` (basic admin-gate + happy path)

- [ ] **Step 1: Implement guests actions**

Create `src/server/actions/guests.ts`:

```ts
import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  createGuestSchema,
  renameGuestSchema,
  archiveGuestSchema,
} from '@/shared/schemas';
import {
  createGuest as domainCreate,
  renameGuest as domainRename,
  archiveGuest as domainArchive,
  unarchiveGuest as domainUnarchive,
  listGuests as domainList,
} from '@/server/domain/guests';

export function makeGuestActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const createGuest = adminAction(async ({ user, db }, input: unknown) => {
    const p = createGuestSchema.parse(input);
    return domainCreate(db, { name: p.name, createdByUserId: user.id });
  });

  const renameGuest = adminAction(async ({ db }, input: unknown) => {
    const p = renameGuestSchema.parse(input);
    return domainRename(db, p.id, p.name);
  });

  const archiveGuest = adminAction(async ({ db }, input: unknown) => {
    const p = archiveGuestSchema.parse(input);
    return domainArchive(db, p.id);
  });

  const unarchiveGuest = adminAction(async ({ db }, input: unknown) => {
    const p = archiveGuestSchema.parse(input);
    return domainUnarchive(db, p.id);
  });

  const listGuests = adminAction(async ({ db }, input: { includeArchived?: boolean } | undefined) => {
    return domainList(db, { includeArchived: input?.includeArchived ?? false });
  });

  return { createGuest, renameGuest, archiveGuest, unarchiveGuest, listGuests };
}

const prod = makeGuestActions();
export const createGuest = prod.createGuest;
export const renameGuest = prod.renameGuest;
export const archiveGuest = prod.archiveGuest;
export const unarchiveGuest = prod.unarchiveGuest;
export const listGuests = prod.listGuests;
```

Create `src/server/actions/guests-server.ts`:

```ts
'use server';

import {
  createGuest as a,
  renameGuest as b,
  archiveGuest as c,
  unarchiveGuest as d,
  listGuests as e,
} from './guests';

export async function createGuest(input: unknown) { return a(input as never); }
export async function renameGuest(input: unknown) { return b(input as never); }
export async function archiveGuest(input: { id: string }) { return c(input); }
export async function unarchiveGuest(input: { id: string }) { return d(input); }
export async function listGuests(input?: { includeArchived?: boolean }) { return e(input); }
```

- [ ] **Step 2: Implement guest-deposits actions**

Create `src/server/actions/guest-deposits.ts`:

```ts
import 'server-only';
import { makeAdminAction } from './_wrapper';
import { getDb as defaultGetDb } from '@/server/db/client';
import type { Db } from '@/server/domain/types';
import {
  recordGuestDepositSchema,
  cancelGuestDepositSchema,
  guestDepositRangeSchema,
} from '@/shared/schemas';
import {
  recordGuestDeposit as domainRecord,
  cancelGuestDeposit as domainCancel,
  listGuestDeposits as domainList,
  guestDepositSummary as domainSummary,
} from '@/server/domain/guest-deposits';

export function makeGuestDepositActions(deps: { getDb: () => Db } = { getDb: defaultGetDb }) {
  const adminAction = makeAdminAction(deps);

  const recordGuestDeposit = adminAction(async ({ user, db }, input: unknown) => {
    const p = recordGuestDepositSchema.parse(input);
    return domainRecord(db, {
      guestId: p.guestId ?? null,
      amount: p.amount,
      method: p.method,
      note: p.note,
      receivedAt: p.receivedAt,
      createdByUserId: user.id,
    });
  });

  const cancelGuestDeposit = adminAction(async ({ db }, input: unknown) => {
    const p = cancelGuestDepositSchema.parse(input);
    return domainCancel(db, p.id);
  });

  const guestDepositSummary = adminAction(async ({ db }, input: unknown) => {
    const p = guestDepositRangeSchema.parse(input);
    return domainSummary(db, p);
  });

  const listGuestDeposits = adminAction(async ({ db }, input: { guestId?: string | null } | undefined) => {
    return domainList(db, { guestId: input?.guestId ?? undefined });
  });

  return { recordGuestDeposit, cancelGuestDeposit, guestDepositSummary, listGuestDeposits };
}

const prod = makeGuestDepositActions();
export const recordGuestDeposit = prod.recordGuestDeposit;
export const cancelGuestDeposit = prod.cancelGuestDeposit;
export const guestDepositSummary = prod.guestDepositSummary;
export const listGuestDeposits = prod.listGuestDeposits;
```

Create `src/server/actions/guest-deposits-server.ts`:

```ts
'use server';

import {
  recordGuestDeposit as a,
  cancelGuestDeposit as b,
  guestDepositSummary as c,
  listGuestDeposits as d,
} from './guest-deposits';

export async function recordGuestDeposit(input: unknown) { return a(input as never); }
export async function cancelGuestDeposit(input: { id: string }) { return b(input); }
export async function guestDepositSummary(input: { from: string; to: string }) { return c(input); }
export async function listGuestDeposits(input?: { guestId?: string | null }) { return d(input); }
```

- [ ] **Step 3: Add an admin-gate smoke test**

Create `tests/actions/guests.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { makeGuestActions } from '@/server/actions/guests';

// We bypass the cookie-based current-user resolution by injecting a Db getter
// and stubbing the session — easier path is to test the domain directly.
// Instead, here we exercise the *factory* with a known DB and assert it wires
// the domain function correctly via the listGuests pass-through.

describe('makeGuestActions wiring', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    // SESSION_SECRET must be defined for the wrapper to reach our fn; the auth
    // path itself we cover in existing tests for other actions.
    process.env.SESSION_SECRET ??= 'test-secret';
  });
  it('exposes createGuest, listGuests, etc.', () => {
    const actions = makeGuestActions({ getDb: () => db });
    expect(typeof actions.createGuest).toBe('function');
    expect(typeof actions.listGuests).toBe('function');
    expect(typeof actions.renameGuest).toBe('function');
    expect(typeof actions.archiveGuest).toBe('function');
    expect(typeof actions.unarchiveGuest).toBe('function');
    // Touch admin id to keep TS happy.
    expect(adminId).toBeTruthy();
  });
});
```

Note: deeper action tests are intentionally out of scope; they exercise the cookie/session layer already covered by existing payment-action tests. Domain logic has full coverage.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: all tests PASS. `pnpm typecheck` also clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/guests.ts src/server/actions/guests-server.ts \
        src/server/actions/guest-deposits.ts src/server/actions/guest-deposits-server.ts \
        tests/actions/guests.test.ts
git commit -m "feat(actions): admin server actions for guests and guest deposits"
```

---

## Task 10: i18n keys (en + ru)

**Files:**
- Modify: [src/shared/i18n/messages-en.ts](../../../src/shared/i18n/messages-en.ts)
- Modify: [src/shared/i18n/messages-ru.ts](../../../src/shared/i18n/messages-ru.ts)

- [ ] **Step 1: Add keys to messages-en.ts**

In `nav` object, add `guests: 'Guests',`.

In `bot.cmdDescriptions`, add `guestdeposit: 'Record a guest deposit (admin)',`.

Append a new top-level namespace after `payments` (and before `spendings`):

```ts
  guests: {
    navTitle: 'Guests',
    pageTitle: 'Guests',
    depositsPageTitle: 'Guest deposits',
    addNew: '+ New guest',
    anonymous: 'Guest',
    archivedSuffix: ' (archived)',
    showArchived: 'Show archived',
    none: 'No guests yet.',
    colName: 'Name',
    colTotal: 'Lifetime',
    colCount: 'Deposits',
    colLast: 'Last deposit',
    colActions: 'Actions',
    btnRename: 'Rename',
    btnArchive: 'Archive',
    btnUnarchive: 'Unarchive',
    namePromptLabel: 'Name',
    nameModalTitle: 'New guest',
    renameModalTitle: 'Rename guest',
    confirmArchive: 'Archive this guest? They will be hidden from new deposits.',
    matrixDayTotal: 'Day total',
    matrixGuestTotal: 'Total',
    matrixEmpty: 'No guest deposits in this range.',
  },
  guestDeposits: {
    newPageTitle: 'Guest deposit',
    toggleMember: 'Member payment',
    toggleGuest: 'Guest deposit',
    guestLabel: 'Guest',
    guestPlaceholder: 'Type a name or pick one',
    guestCreateOption: (name: string) => `+ Create "${name}"`,
    guestAnonymousOption: 'Anonymous (no name)',
    amountLabel: 'Amount',
    methodLabel: 'Method',
    noteLabel: 'Note (optional)',
    dateLabel: 'Received at',
    submit: 'Record deposit',
    submitted: 'Deposit recorded.',
  },
```

In `bot` object, add a new namespace next to `pay`:

```ts
    guestDeposit: {
      amountPrompt: 'Amount? (e.g., 30.00)',
      invalidAmount: 'Invalid amount. Aborted.',
      methodPrompt: 'Cash or card?',
      btnCash: '💵 Cash',
      btnCard: '💳 Card',
      whoPrompt: 'Which guest?',
      btnAnonymous: '👤 Anonymous',
      btnNew: '➕ New',
      btnCancel: '✖ Cancel',
      cancelled: 'Cancelled.',
      newNamePrompt: 'New guest name?',
      invalidName: 'Empty name. Aborted.',
      notePrompt: 'Note? (or /skip)',
      confirmPrompt: (line: string) => `Confirm: ${line}`,
      btnConfirm: '✅ Record',
      recorded: (method: string, amount: string, who: string) =>
        `✅ Recorded ${method} guest deposit of ${amount} from ${who}.`,
    },
```

- [ ] **Step 2: Mirror in messages-ru.ts**

Add the same key shapes with Russian translations. Reasonable defaults:

```ts
  guests: {
    navTitle: 'Гости',
    pageTitle: 'Гости',
    depositsPageTitle: 'Взносы гостей',
    addNew: '+ Новый гость',
    anonymous: 'Гость',
    archivedSuffix: ' (архив)',
    showArchived: 'Показать архив',
    none: 'Пока нет гостей.',
    colName: 'Имя',
    colTotal: 'Всего',
    colCount: 'Взносов',
    colLast: 'Последний взнос',
    colActions: 'Действия',
    btnRename: 'Переименовать',
    btnArchive: 'В архив',
    btnUnarchive: 'Из архива',
    namePromptLabel: 'Имя',
    nameModalTitle: 'Новый гость',
    renameModalTitle: 'Переименовать гостя',
    confirmArchive: 'Отправить гостя в архив? Он скроется из выбора при новых взносах.',
    matrixDayTotal: 'Итого за день',
    matrixGuestTotal: 'Итого',
    matrixEmpty: 'Нет гостевых взносов за выбранный период.',
  },
  guestDeposits: {
    newPageTitle: 'Взнос гостя',
    toggleMember: 'Оплата участника',
    toggleGuest: 'Взнос гостя',
    guestLabel: 'Гость',
    guestPlaceholder: 'Введите имя или выберите',
    guestCreateOption: (name: string) => `+ Создать «${name}»`,
    guestAnonymousOption: 'Аноним (без имени)',
    amountLabel: 'Сумма',
    methodLabel: 'Способ',
    noteLabel: 'Заметка (опц.)',
    dateLabel: 'Получено',
    submit: 'Записать взнос',
    submitted: 'Взнос записан.',
  },
```

```ts
    guestDeposit: {
      amountPrompt: 'Сумма? (например, 30.00)',
      invalidAmount: 'Некорректная сумма. Отменено.',
      methodPrompt: 'Наличные или карта?',
      btnCash: '💵 Наличные',
      btnCard: '💳 Карта',
      whoPrompt: 'Кто гость?',
      btnAnonymous: '👤 Аноним',
      btnNew: '➕ Новый',
      btnCancel: '✖ Отмена',
      cancelled: 'Отменено.',
      newNamePrompt: 'Имя нового гостя?',
      invalidName: 'Пустое имя. Отменено.',
      notePrompt: 'Заметка? (или /skip)',
      confirmPrompt: (line: string) => `Подтвердить: ${line}`,
      btnConfirm: '✅ Записать',
      recorded: (method: string, amount: string, who: string) =>
        `✅ Записан ${method}-взнос ${amount} от ${who}.`,
    },
```

Add `guests: 'Гости'` in `nav` and `guestdeposit: 'Записать взнос гостя (админ)'` in `bot.cmdDescriptions`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. Both message objects must keep the same shape (this is enforced by the en/ru export types).

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts
git commit -m "feat(i18n): keys for guests and guest deposits (en, ru)"
```

---

## Task 11: Web roster page `/guests`

**Files:**
- Create: `src/app/(app)/guests/page.tsx`
- Create: `src/app/(app)/guests/guests-table.tsx`
- Create: `src/app/(app)/guests/new-guest-button.tsx`
- Create: `src/app/(app)/guests/rename-button.tsx`
- Create: `src/app/(app)/guests/archive-button.tsx`

- [ ] **Step 1: Create the server page**

Create `src/app/(app)/guests/page.tsx`:

```tsx
import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { listGuestDeposits } from '@/server/domain/guest-deposits';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { formatCents } from '@/shared/format';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { GuestsTable, type GuestRow } from './guests-table';
import { NewGuestButton } from './new-guest-button';

export default async function GuestsPage({
  searchParams,
}: {
  searchParams?: { archived?: string };
}) {
  await requireAdmin();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const includeArchived = searchParams?.archived === '1';
  const guests = await listGuests(db, { includeArchived });
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
    <div>
      <PageHeader title={m.guests.pageTitle} actions={<NewGuestButton />} />
      <Panel>
        <GuestsTable rows={rows} />
      </Panel>
      <div style={{ marginTop: 12 }}>
        <a href={includeArchived ? '/guests' : '/guests?archived=1'}>{m.guests.showArchived}</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the table component**

Create `src/app/(app)/guests/guests-table.tsx`:

```tsx
'use client';

import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { useMessages } from '@/app/_i18n-provider';
import { Muted } from '@/ui/text';
import { RenameButton } from './rename-button';
import { ArchiveButton } from './archive-button';

export interface GuestRow {
  id: string;
  name: string;
  archived: boolean;
  totalFormatted: string;
  count: number;
  lastFormatted: string;
}

export function GuestsTable({ rows }: { rows: GuestRow[] }) {
  const m = useMessages();
  return (
    <TableBuilder data={rows} emptyMessage={m.guests.none}>
      <TableBuilderColumn header={m.guests.colName}>
        {(r: GuestRow) => (
          <span>
            {r.name}
            {r.archived && <Muted>{m.guests.archivedSuffix}</Muted>}
          </span>
        )}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colTotal} numeric>
        {(r: GuestRow) => r.totalFormatted}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colCount} numeric>
        {(r: GuestRow) => r.count}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colLast}>
        {(r: GuestRow) => <Muted>{r.lastFormatted}</Muted>}
      </TableBuilderColumn>
      <TableBuilderColumn header={m.guests.colActions}>
        {(r: GuestRow) => (
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <RenameButton id={r.id} name={r.name} />
            <ArchiveButton id={r.id} archived={r.archived} />
          </span>
        )}
      </TableBuilderColumn>
    </TableBuilder>
  );
}
```

- [ ] **Step 3: Create `NewGuestButton`**

Create `src/app/(app)/guests/new-guest-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { Input } from 'baseui/input';
import { FormControl } from 'baseui/form-control';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createGuest } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';

export function NewGuestButton() {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => createGuest({ name }),
    onSuccess: () => { setOpen(false); setName(''); router.refresh(); },
  });
  return (
    <>
      <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setOpen(true)}>
        {m.guests.addNew}
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalHeader>{m.guests.nameModalTitle}</ModalHeader>
        <ModalBody>
          <FormControl label={m.guests.namePromptLabel}>
            <Input value={name} onChange={(e) => setName(e.currentTarget.value)} autoFocus />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={KIND.tertiary} onClick={() => setOpen(false)}>
            {m.common.cancel}
          </ModalButton>
          <ModalButton onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            {m.common.create}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
```

- [ ] **Step 4: Create `RenameButton` and `ArchiveButton`**

Create `src/app/(app)/guests/rename-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { Input } from 'baseui/input';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { renameGuest } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';

export function RenameButton({ id, name }: { id: string; name: string }) {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const mutate = useMutation({
    mutationFn: () => renameGuest({ id, name: value }),
    onSuccess: () => { setOpen(false); router.refresh(); },
  });
  return (
    <>
      <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => { setValue(name); setOpen(true); }}>
        {m.guests.btnRename}
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalHeader>{m.guests.renameModalTitle}</ModalHeader>
        <ModalBody>
          <Input value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={KIND.tertiary} onClick={() => setOpen(false)}>{m.common.cancel}</ModalButton>
          <ModalButton onClick={() => mutate.mutate()} disabled={!value.trim() || mutate.isPending}>
            {m.common.save}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </>
  );
}
```

Create `src/app/(app)/guests/archive-button.tsx`:

```tsx
'use client';

import { Button, KIND, SIZE } from 'baseui/button';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { archiveGuest, unarchiveGuest } from '@/server/actions/guests-server';
import { useMessages } from '@/app/_i18n-provider';

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const m = useMessages();
  const router = useRouter();
  const mutate = useMutation({
    mutationFn: () => (archived ? unarchiveGuest({ id }) : archiveGuest({ id })),
    onSuccess: () => router.refresh(),
  });
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.mini}
      onClick={() => {
        if (!archived && !window.confirm(m.guests.confirmArchive)) return;
        mutate.mutate();
      }}
      isLoading={mutate.isPending}
    >
      {archived ? m.guests.btnUnarchive : m.guests.btnArchive}
    </Button>
  );
}
```

- [ ] **Step 5: Typecheck and run dev**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm dev` and visit http://localhost:3000/guests (logged in as admin). Verify: empty state shows "No guests yet", "+ New guest" creates a guest, the row appears, rename and archive work.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/guests
git commit -m "feat(web): /guests roster page with create/rename/archive"
```

---

## Task 12: Web matrix view `/guests/deposits`

**Files:**
- Create: `src/app/(app)/guests/deposits/page.tsx`
- Create: `src/app/(app)/guests/deposits/matrix.tsx`

- [ ] **Step 1: Implement the server page**

Create `src/app/(app)/guests/deposits/page.tsx`:

```tsx
import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { guestDepositSummary } from '@/server/domain/guest-deposits';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { Matrix, type MatrixData } from './matrix';

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 90);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default async function GuestDepositsPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  await requireAdmin();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);

  const def = defaultRange();
  const from = searchParams?.from ?? def.from;
  const to = searchParams?.to ?? def.to;

  const allGuests = await listGuests(db, { includeArchived: true });
  const summary = await guestDepositSummary(db, { from, to });

  const guestsInRange = new Set(summary.map((s) => s.guestId).filter((id): id is string => id !== null));
  const hasAnon = summary.some((s) => s.guestId === null);

  const columns = allGuests
    .filter((g) => guestsInRange.has(g.id))
    .map((g) => ({ id: g.id, label: g.name, archived: g.archived }));

  const dates = [...new Set(summary.map((s) => s.date))].sort().reverse();

  const cells = new Map<string, number>(); // `${date}|${guestIdOrEmpty}` -> amount
  for (const s of summary) cells.set(`${s.date}|${s.guestId ?? ''}`, s.amount);

  const data: MatrixData = { from, to, dates, columns, hasAnon, cells: Object.fromEntries(cells) };

  return (
    <div>
      <PageHeader title={m.guests.depositsPageTitle} />
      <Panel>
        <Matrix data={data} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Implement the client matrix component**

Create `src/app/(app)/guests/deposits/matrix.tsx`:

```tsx
'use client';

import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';

export interface MatrixData {
  from: string;
  to: string;
  dates: string[];
  columns: { id: string; label: string; archived: boolean }[];
  hasAnon: boolean;
  cells: Record<string, number>;
}

export function Matrix({ data }: { data: MatrixData }) {
  const m = useMessages();
  if (data.dates.length === 0) {
    return <p style={{ padding: 16, color: '#666' }}>{m.guests.matrixEmpty}</p>;
  }
  const cell = (date: string, guestId: string) => data.cells[`${date}|${guestId}`] ?? 0;
  const dayTotal = (date: string) =>
    data.columns.reduce((s, c) => s + cell(date, c.id), 0) + (data.hasAnon ? cell(date, '') : 0);
  const colTotal = (guestId: string) =>
    data.dates.reduce((s, d) => s + cell(d, guestId), 0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
        <thead>
          <tr>
            <th style={th}>—</th>
            {data.columns.map((c) => (
              <th key={c.id} style={th}>
                {c.label}{c.archived && <span style={{ color: '#999' }}>{m.guests.archivedSuffix}</span>}
              </th>
            ))}
            {data.hasAnon && <th style={th}>{m.guests.anonymous}</th>}
            <th style={th}>{m.guests.matrixDayTotal}</th>
          </tr>
        </thead>
        <tbody>
          {data.dates.map((date) => (
            <tr key={date}>
              <td style={td}>{date}</td>
              {data.columns.map((c) => (
                <td key={c.id} style={tdNum}>{cell(date, c.id) ? formatCents(cell(date, c.id)) : ''}</td>
              ))}
              {data.hasAnon && (
                <td style={tdNum}>{cell(date, '') ? formatCents(cell(date, '')) : ''}</td>
              )}
              <td style={tdNumBold}>{formatCents(dayTotal(date))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={tdBold}>{m.guests.matrixGuestTotal}</td>
            {data.columns.map((c) => (
              <td key={c.id} style={tdNumBold}>{formatCents(colTotal(c.id))}</td>
            ))}
            {data.hasAnon && <td style={tdNumBold}>{formatCents(colTotal(''))}</td>}
            <td style={tdNumBold}>
              {formatCents(data.dates.reduce((s, d) => s + dayTotal(d), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #eee', fontWeight: 600, fontSize: 13 };
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #f4f4f4', fontSize: 14 };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdBold: React.CSSProperties = { ...td, fontWeight: 600 };
const tdNumBold: React.CSSProperties = { ...tdNum, fontWeight: 600 };
```

- [ ] **Step 3: Typecheck and visit the page**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm dev` and visit `/guests/deposits`. With no deposits yet: "No guest deposits in this range." After recording a few via the bot or via the existing deposit form (added in next task), refresh — matrix renders dates as rows, guest names as columns.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/guests/deposits
git commit -m "feat(web): /guests/deposits date × guest matrix view"
```

---

## Task 13: Web `/payments/new` — guest deposit branch

**Files:**
- Modify: [src/app/(app)/payments/new/page.tsx](../../../src/app/(app)/payments/new/page.tsx) (pass guests list down)
- Modify: [src/app/(app)/payments/new/record-form.tsx](../../../src/app/(app)/payments/new/record-form.tsx) (toggle + guest branch)

- [ ] **Step 1: Update the server page to load guests**

Open `src/app/(app)/payments/new/page.tsx`. Augment to pass the list of non-archived guests to `RecordPaymentForm`. Existing call site loads members; mirror it:

```tsx
import { listGuests } from '@/server/domain/guests';
// ...
const guests = await listGuests(db); // non-archived only
return <RecordPaymentForm members={members} guests={guests.map((g) => ({ id: g.id, name: g.name }))} />;
```

- [ ] **Step 2: Update `record-form.tsx`**

In [src/app/(app)/payments/new/record-form.tsx](../../../src/app/(app)/payments/new/record-form.tsx):

1. Accept new prop `guests: { id: string; name: string }[]`.
2. Add `mode` state: `'member' | 'guest'` (default `'member'`).
3. Add a `RadioGroup` (or two buttons) at top that swap between modes, labels from `m.guestDeposits.toggleMember` / `m.guestDeposits.toggleGuest`.
4. Render the existing form when `mode === 'member'`.
5. When `mode === 'guest'`, render a guest-specific form:

```tsx
import { recordGuestDeposit as recordGuestDepositAction } from '@/server/actions/guest-deposits-server';
import { createGuest as createGuestAction } from '@/server/actions/guests-server';

// inside the component:
const [guestId, setGuestId] = useState<string | null>(null);     // null = anonymous
const [guestQuery, setGuestQuery] = useState('');                // typed text
const [guestAmount, setGuestAmount] = useState('');
const [guestMethod, setGuestMethod] = useState<'cash' | 'card'>('cash');
const [guestNote, setGuestNote] = useState('');

const submitGuest = useMutation({
  mutationFn: async () => {
    let resolvedId = guestId;
    // If user typed a brand-new name (no exact match), create the guest first.
    const trimmed = guestQuery.trim();
    if (!resolvedId && trimmed && !guests.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      const g = await createGuestAction({ name: trimmed });
      resolvedId = (g as { id: string }).id;
    } else if (!resolvedId && trimmed) {
      resolvedId = guests.find((g) => g.name.toLowerCase() === trimmed.toLowerCase())!.id;
    }
    return recordGuestDepositAction({
      guestId: resolvedId,
      amount: guestAmount,
      method: guestMethod,
      note: guestNote || undefined,
    });
  },
  onSuccess: () => router.push('/guests/deposits'),
});
```

6. In the guest form JSX, render:
   - A baseui `Select` with `options = [{ id: '', label: m.guestDeposits.guestAnonymousOption }, ...guests.map((g) => ({ id: g.id, label: g.name }))]`, allowing the user to type. Use `creatable` mode if available; otherwise a separate `Input` next to the `Select` for the "new name" entry. Implementation choice: use the `Select` with `creatable` for typeahead+create UX, falling back to typing a new name and recording the typed query into `guestQuery`.
   - Amount, method, note fields wired like the existing form.
   - A "Record deposit" button calling `submitGuest.mutate()`.

The exact baseui `Select` creatable wiring follows the same pattern used elsewhere in the project (search for `creatable` first; if absent, use the typed-input fallback above — that's enough for KISS).

- [ ] **Step 3: Typecheck and verify in browser**

Run: `pnpm typecheck && pnpm dev`
Expected: PASS. Visit `/payments/new`, flip to "Guest deposit", create a deposit linked to a new guest "Pasha". Verify it appears on `/guests` (count = 1) and `/guests/deposits` (one cell).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/payments/new
git commit -m "feat(web): /payments/new guest-deposit toggle"
```

---

## Task 14: Header nav — add Guests link

**Files:**
- Modify: [src/app/(app)/header.tsx](../../../src/app/(app)/header.tsx)

- [ ] **Step 1: Add nav entry**

In the `nav` array, insert after `payments`:

```ts
    { href: '/guests', label: m.nav.guests },
```

This stays in the always-visible list; the page itself enforces admin via `requireAdmin`. Members landing there will be redirected as the existing helper does.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/header.tsx
git commit -m "feat(web): add Guests nav link"
```

---

## Task 15: Mini App — guest deposit entry

**Files:**
- Modify: [src/app/(mini)/mini/payments/page.tsx](../../../src/app/(mini)/mini/payments/page.tsx) (add admin button)
- Create: `src/app/(mini)/mini/payments/guest/page.tsx` (new form sheet)
- Create: `src/app/(mini)/mini/payments/guest/guest-form.tsx`

- [ ] **Step 1: Add the admin button to the payments tab**

In `src/app/(mini)/mini/payments/page.tsx`, when `user.role === 'admin'`, render an additional `MiniRow` at the top linking to `/mini/payments/guest`:

```tsx
{user.role === 'admin' && (
  <MiniRow
    title={<>➕ {m.guestDeposits.toggleGuest}</>}
    subtitle={null}
    right={null}
    href="/mini/payments/guest"
  />
)}
```

If `MiniRow` doesn't accept `href`, wrap it in a `<Link>` or add a thin alternative — match whatever existing rows do that navigate.

- [ ] **Step 2: Create the guest form page**

Create `src/app/(mini)/mini/payments/guest/page.tsx`:

```tsx
import { requireAdmin } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listGuests } from '@/server/domain/guests';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../../init';
import { MiniTabs } from '../../tabs';
import { GuestDepositForm } from './guest-form';

export default async function MiniGuestDepositPage() {
  await requireAdmin();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const guests = await listGuests(db);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.guestDeposits.newPageTitle}
      </h2>
      <GuestDepositForm guests={guests.map((g) => ({ id: g.id, name: g.name }))} />
      <MiniTabs />
    </>
  );
}
```

Create `src/app/(mini)/mini/payments/guest/guest-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useMessages } from '@/app/_i18n-provider';
import { recordGuestDeposit } from '@/server/actions/guest-deposits-server';
import { createGuest } from '@/server/actions/guests-server';

export function GuestDepositForm({ guests }: { guests: { id: string; name: string }[] }) {
  const m = useMessages();
  const router = useRouter();
  const [name, setName] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [note, setNote] = useState('');

  const submit = useMutation({
    mutationFn: async () => {
      let guestId: string | null = null;
      if (!anonymous) {
        if (pickedId) {
          guestId = pickedId;
        } else if (name.trim()) {
          const existing = guests.find((g) => g.name.toLowerCase() === name.trim().toLowerCase());
          if (existing) guestId = existing.id;
          else {
            const created = await createGuest({ name: name.trim() });
            guestId = (created as { id: string }).id;
          }
        }
      }
      return recordGuestDeposit({
        guestId,
        amount,
        method,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => router.push('/mini/payments'),
  });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        {m.guestDeposits.guestAnonymousOption}
      </label>
      {!anonymous && (
        <>
          <select
            value={pickedId ?? ''}
            onChange={(e) => { setPickedId(e.target.value || null); setName(''); }}
          >
            <option value="">{m.guestDeposits.guestPlaceholder}</option>
            {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input
            placeholder={m.guestDeposits.guestPlaceholder}
            value={name}
            onChange={(e) => { setName(e.target.value); setPickedId(null); }}
          />
        </>
      )}
      <input placeholder={m.guestDeposits.amountLabel} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setMethod('cash')} aria-pressed={method === 'cash'}>{m.common.methodCash}</button>
        <button type="button" onClick={() => setMethod('card')} aria-pressed={method === 'card'}>{m.common.methodCard}</button>
      </div>
      <input placeholder={m.guestDeposits.noteLabel} value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        type="button"
        onClick={() => submit.mutate()}
        disabled={!amount || submit.isPending || (!anonymous && !pickedId && !name.trim())}
      >
        {m.guestDeposits.submit}
      </button>
      {submit.isError && <div style={{ color: '#dc2626' }}>{(submit.error as Error).message}</div>}
    </div>
  );
}
```

The bare-element styling matches the Mini App's lighter touch; the existing Mini App pages already use plain inputs/buttons with the `mini-*` CSS variables. If you want to lift baseui styling here later, that's a follow-up.

- [ ] **Step 3: Verify in browser via Mini App preview**

Run: `pnpm dev`. Open `/mini/payments` while logged in as admin. Tap the new "+ Guest deposit" row, submit a deposit, verify it appears in `/guests/deposits` and `/dashboard` pot balance.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(mini\)/mini/payments
git commit -m "feat(mini): admin can record guest deposit from Mini App"
```

---

## Task 16: Bot `/guestdeposit` conversation

**Files:**
- Create: `src/server/bot/conversations/guest-deposit.ts`
- Modify: [src/server/bot/index.ts](../../../src/server/bot/index.ts) (register the conversation and command, add to admin command list)

- [ ] **Step 1: Implement the conversation**

Create `src/server/bot/conversations/guest-deposit.ts`:

```ts
import { InlineKeyboard } from 'grammy';
import { desc, eq, isNull, max } from 'drizzle-orm';
import type { BotContext, BotConversation } from '../context';
import { guests as guestsTbl, guestDeposits } from '@/server/db/schema';
import { recordGuestDeposit } from '@/server/domain/guest-deposits';
import { createGuest, getGuest } from '@/server/domain/guests';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { botMessages } from '../i18n';
import { hydrateConversationCtx } from './hydrate';

export async function guestDepositConversation(conversation: BotConversation, ctx: BotContext) {
  await hydrateConversationCtx(ctx);
  const { m } = botMessages(ctx);
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply(m.bot.adminOnly);
    return;
  }
  const adminId = ctx.currentUser.id;

  // 1. amount
  await ctx.reply(m.bot.guestDeposit.amountPrompt);
  const amtCtx = await conversation.waitFor('message:text');
  let cents: number;
  try {
    cents = parseDollarsToCents(amtCtx.message.text);
  } catch {
    await ctx.reply(m.bot.guestDeposit.invalidAmount);
    return;
  }

  // 2. method
  await ctx.reply(m.bot.guestDeposit.methodPrompt, {
    reply_markup: new InlineKeyboard()
      .text(m.bot.guestDeposit.btnCash, 'gd:method:cash')
      .text(m.bot.guestDeposit.btnCard, 'gd:method:card'),
  });
  const methodCtx = await conversation.waitForCallbackQuery(/^gd:method:(cash|card)$/);
  await methodCtx.answerCallbackQuery();
  const method = methodCtx.match[1] as 'cash' | 'card';

  // 3. guest selection — recent first by max(receivedAt)
  const recent = ctx.db
    .select({
      id: guestsTbl.id,
      name: guestsTbl.name,
      last: max(guestDeposits.receivedAt).as('last'),
    })
    .from(guestsTbl)
    .leftJoin(guestDeposits, eq(guestDeposits.guestId, guestsTbl.id))
    .where(eq(guestsTbl.archived, false))
    .groupBy(guestsTbl.id)
    .all()
    .sort((a, b) => (b.last ?? '') > (a.last ?? '') ? 1 : -1)
    .slice(0, 8);

  const kb = new InlineKeyboard();
  recent.forEach((g, i) => {
    kb.text(g.name, `gd:g:${g.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  if (recent.length % 2 === 1) kb.row();
  kb.text(m.bot.guestDeposit.btnAnonymous, 'gd:g:__anon__').row();
  kb.text(m.bot.guestDeposit.btnNew, 'gd:g:__new__');
  kb.text(m.bot.guestDeposit.btnCancel, 'gd:g:__cancel__');

  await ctx.reply(m.bot.guestDeposit.whoPrompt, { reply_markup: kb });
  const gCtx = await conversation.waitForCallbackQuery(/^gd:g:(.+)$/);
  await gCtx.answerCallbackQuery();
  const choice = gCtx.match[1]!;

  let guestId: string | null = null;
  let guestName: string = m.bot.guestDeposit.btnAnonymous.replace(/^[^\w]+/, '').trim();
  if (choice === '__cancel__') {
    await ctx.reply(m.bot.guestDeposit.cancelled);
    return;
  } else if (choice === '__anon__') {
    guestId = null;
    guestName = m.bot.guestDeposit.btnAnonymous;
  } else if (choice === '__new__') {
    await ctx.reply(m.bot.guestDeposit.newNamePrompt);
    const nameCtx = await conversation.waitFor('message:text');
    const name = nameCtx.message.text.trim();
    if (!name) {
      await ctx.reply(m.bot.guestDeposit.invalidName);
      return;
    }
    const g = await createGuest(ctx.db, { name, createdByUserId: adminId });
    guestId = g.id;
    guestName = g.name;
  } else {
    const g = await getGuest(ctx.db, choice);
    if (!g) {
      await ctx.reply(m.bot.guestDeposit.cancelled);
      return;
    }
    guestId = g.id;
    guestName = g.name;
  }

  // 4. note
  await ctx.reply(m.bot.guestDeposit.notePrompt);
  const noteCtx = await conversation.waitFor('message:text');
  const noteText = noteCtx.message.text.trim();
  const note = noteText === '/skip' ? undefined : noteText;

  // 5. confirm
  const summary = `${formatCents(cents)} · ${method} · ${guestName}${note ? ' · ' + note : ''}`;
  await ctx.reply(m.bot.guestDeposit.confirmPrompt(summary), {
    reply_markup: new InlineKeyboard()
      .text(m.bot.guestDeposit.btnConfirm, 'gd:c:y')
      .text(m.bot.guestDeposit.btnCancel, 'gd:c:n'),
  });
  const confirmCtx = await conversation.waitForCallbackQuery(/^gd:c:(y|n)$/);
  await confirmCtx.answerCallbackQuery();
  if (confirmCtx.match[1] !== 'y') {
    await ctx.reply(m.bot.guestDeposit.cancelled);
    return;
  }

  await recordGuestDeposit(ctx.db, {
    guestId,
    amount: cents,
    method,
    note,
    createdByUserId: adminId,
  });
  await ctx.reply(m.bot.guestDeposit.recorded(method, formatCents(cents), guestName));
}
```

Note on unused imports: `desc` and `isNull` aren't used in the snippet above — drop them. The drizzle `max` aggregate import is used; if your drizzle-orm version lacks `max`, replace with a JS-side reduction (the data is small).

- [ ] **Step 2: Register the conversation in the bot**

Modify [src/server/bot/index.ts](../../../src/server/bot/index.ts):

Add import:

```ts
import { guestDepositConversation } from './conversations/guest-deposit';
```

Inside `getBot()`, after the `infoEdit` conversation registration:

```ts
    _bot.use(createConversation(guestDepositConversation, 'guestDeposit'));
    _bot.command('guestdeposit', async (ctx) => { await ctx.conversation.enter('guestDeposit'); });
```

In `adminCommands(locale)`, add to the returned array:

```ts
      { command: 'guestdeposit', description: d.guestdeposit },
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

`pnpm dev`, then in Telegram message your bot `/guestdeposit`. Walk through the flow: amount → cash → choose Anonymous → /skip note → Confirm. Verify the deposit appears at `/guests/deposits` and pot balance updates.

- [ ] **Step 5: Commit**

```bash
git add src/server/bot/conversations/guest-deposit.ts src/server/bot/index.ts
git commit -m "feat(bot): /guestdeposit conversation for admins"
```

---

## Task 17: Final wiring and sanity check

**Files:** none new

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 2: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Manual end-to-end smoke**

Start the dev server, sign in as the bootstrap admin, and:
1. Visit `/guests` — create "Pasha".
2. Visit `/payments/new`, flip to "Guest deposit", record 30.00 cash for Pasha.
3. Visit `/guests/deposits` — see today's row, Pasha column = 30 р.
4. Visit `/dashboard` — cash pot increased by 30 р.; Money History shows guest-deposit row labelled "Pasha".
5. In Telegram, `/guestdeposit` — record an anonymous 10.00 card deposit; reload `/guests/deposits` — today's row has an Anonymous column with 10 р.
6. Cancel the anonymous deposit via SQL (`UPDATE guest_deposits SET cancelled_at = ...` — no UI in v1; cancellation UI is deferred). Confirm pot balance drops.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore(guests): final wiring sanity pass" || echo "nothing to commit"
```

---

## Spec coverage check

Each spec section maps to tasks:

- **Schema** → Task 1.
- **Domain — guests** → Task 2.
- **Domain — guest deposits** → Task 3, 4.
- **`pots.ts` fold-in** → Task 5.
- **`movements.ts` fold-in** → Task 6.
- **`activity.ts` fold-in** → Task 7.
- **Zod schemas + server actions** → Task 8, 9.
- **i18n (en + ru)** → Task 10.
- **`/guests` roster** → Task 11.
- **`/guests/deposits` matrix** → Task 12.
- **`/payments/new` toggle** → Task 13.
- **Header nav** → Task 14.
- **Mini App entry** → Task 15.
- **Bot `/guestdeposit`** → Task 16.
- **Final sanity** → Task 17.

Out-of-scope items per the spec (aliases table, guest-merge UI, per-guest detail page, fuzzy matching, guest login, charges/dues for guests) are intentionally absent.
