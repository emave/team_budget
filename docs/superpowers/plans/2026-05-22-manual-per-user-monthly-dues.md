# Manual Per-User Monthly Dues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only per-user "Charge monthly dues" button on the member detail page that creates exactly one `monthly_dues` charge for a chosen `YYYY-MM`, plus a regression test asserting the daily cron never double-charges a member who already has a charge for the period.

**Architecture:** Extract a `chargeMemberDues(db, {userId, period, createdByUserId})` domain function in `src/server/domain/dues.ts` that owns the per-user creation rules (validate period, amount, user; conflict check; create charge; auto-consume wallet credit). Refactor `generateMonthlyDues` to call it in a loop, swallowing the `MemberAlreadyChargedError`. Expose a new admin server action and a small `react-hook-form` UI component on `/members/[id]`.

**Tech Stack:** Next.js App Router, Drizzle ORM (SQLite), Zod, react-hook-form, @tanstack/react-query, Vitest, Baseui (button/form-control/input).

**Spec:** [docs/superpowers/specs/2026-05-22-manual-per-user-monthly-dues-design.md](../specs/2026-05-22-manual-per-user-monthly-dues-design.md)

---

## File Structure

**Modify:**
- `src/server/domain/dues.ts` — add `MemberAlreadyChargedError` + `chargeMemberDues`; refactor `generateMonthlyDues` loop body.
- `src/shared/schemas.ts` — add `chargeMemberDuesSchema`.
- `src/server/actions/charges.ts` — add `chargeMemberDues` admin action.
- `src/server/actions/charges-server.ts` — re-export the new action.
- `src/server/jobs/monthly-dues.ts` — extract `notifyDuesCreated(db, charge)` helper; per-user paid loop uses it.
- `src/app/(app)/members/[id]/page.tsx` — read settings, pass `monthlyDuesAmount` to a new admin-only block.
- `src/shared/i18n/messages-en.ts` — add `members.dues.*` keys.
- `src/shared/i18n/messages-ru.ts` — add `members.dues.*` keys (mirroring shape).
- `tests/domain/dues.test.ts` — extend with `chargeMemberDues` suite + regression test.
- `tests/actions/charges.test.ts` — extend with `chargeMemberDues` action tests.

**Create:**
- `src/app/(app)/members/[id]/charge-dues-form.tsx` — new client component.

---

## Task 1: Domain — happy-path test for `chargeMemberDues`

**Files:**
- Test: `tests/domain/dues.test.ts`

- [ ] **Step 1: Append the happy-path test**

Append to `tests/domain/dues.test.ts` (after the existing `describe('generateMonthlyDues', …)` block):

```ts
import { chargeMemberDues, MemberAlreadyChargedError } from '@/server/domain/dues';

describe('chargeMemberDues', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    memberId = (await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' })).id;
    await updateMonthlyDuesAmount(db, 5000);
  });

  it('creates a monthly_dues charge for the user and period at current settings amount', async () => {
    const c = await chargeMemberDues(db, {
      userId: memberId,
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(c.type).toBe('monthly_dues');
    expect(c.userId).toBe(memberId);
    expect(c.billingPeriod).toBe('2026-05');
    expect(c.amount).toBe(5000);
    expect(c.status).toBe('open');
  });
});
```

Also extend the existing top-of-file import line for `@/server/domain/dues` to include `chargeMemberDues, MemberAlreadyChargedError` (instead of adding a second `import` statement). The current line is:

```ts
import { generateMonthlyDues } from '@/server/domain/dues';
```

Change to:

```ts
import { chargeMemberDues, MemberAlreadyChargedError, generateMonthlyDues } from '@/server/domain/dues';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain/dues.test.ts -t "creates a monthly_dues charge for the user"`

Expected: FAIL with a TS/module error — `chargeMemberDues` and `MemberAlreadyChargedError` are not exported from `@/server/domain/dues`.

- [ ] **Step 3: Implement `chargeMemberDues` and `MemberAlreadyChargedError`**

Edit `src/server/domain/dues.ts`. Append to the bottom of the file (do not remove the existing exports):

```ts
import { type Charge } from './charges';
import { consumeCreditForCharge } from './credit';

export class MemberAlreadyChargedError extends Error {
  constructor(public readonly existingCharge: Charge) {
    super(`member already has monthly_dues charge for ${existingCharge.billingPeriod}`);
    this.name = 'MemberAlreadyChargedError';
  }
}

export interface ChargeMemberDuesInput {
  userId: string;
  period: string;
  createdByUserId: string;
}

export async function chargeMemberDues(
  db: Db,
  input: ChargeMemberDuesInput,
): Promise<Charge> {
  if (!/^\d{4}-\d{2}$/.test(input.period)) {
    throw new Error(`invalid period: ${input.period}`);
  }
  const s = await getOrCreateSettings(db);
  if (s.monthlyDuesAmount <= 0) {
    throw new Error('monthly_dues_amount must be set to a positive value before generating');
  }

  const user = db.select().from(users).where(eq(users.id, input.userId)).get();
  if (!user) throw new Error(`user ${input.userId} not found`);
  if (!user.isActive) throw new Error(`user ${input.userId} is not active`);

  const existing = db
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.userId, input.userId),
        eq(charges.type, 'monthly_dues'),
        eq(charges.billingPeriod, input.period),
      ),
    )
    .get();
  if (existing) throw new MemberAlreadyChargedError(existing);

  const id = randomUUID();
  db.insert(charges)
    .values({
      id,
      userId: input.userId,
      type: 'monthly_dues',
      amount: s.monthlyDuesAmount,
      description: `Monthly dues — ${input.period}`,
      billingPeriod: input.period,
      status: 'open',
      createdByUserId: input.createdByUserId,
    })
    .run();

  await consumeCreditForCharge(db, id);

  const c = db.select().from(charges).where(eq(charges.id, id)).get();
  if (!c) throw new Error(`failed to read back charge ${id}`);
  return c;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/domain/dues.test.ts -t "creates a monthly_dues charge for the user"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/dues.ts tests/domain/dues.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): chargeMemberDues for per-user manual dues

Adds a domain function that creates one monthly_dues charge for
(user, period) at the current settings amount, auto-consuming wallet
credit. Throws MemberAlreadyChargedError on conflict.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Domain — validation tests

**Files:**
- Test: `tests/domain/dues.test.ts`

- [ ] **Step 1: Add validation tests inside the `chargeMemberDues` describe block**

Append these `it(...)` blocks to the `describe('chargeMemberDues', …)` block:

```ts
it('rejects invalid period format', async () => {
  await expect(
    chargeMemberDues(db, { userId: memberId, period: '2026-5', createdByUserId: adminId }),
  ).rejects.toThrow(/invalid period/);
  await expect(
    chargeMemberDues(db, { userId: memberId, period: 'foo', createdByUserId: adminId }),
  ).rejects.toThrow(/invalid period/);
});

it('rejects when monthly dues amount is not set', async () => {
  await updateMonthlyDuesAmount(db, 0);
  await expect(
    chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
  ).rejects.toThrow(/monthly_dues_amount must be set/);
});

it('rejects when user does not exist', async () => {
  await expect(
    chargeMemberDues(db, {
      userId: '00000000-0000-0000-0000-000000000000',
      period: '2026-05',
      createdByUserId: adminId,
    }),
  ).rejects.toThrow(/not found/);
});

it('rejects when user is inactive', async () => {
  await deactivateUser(db, memberId);
  await expect(
    chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
  ).rejects.toThrow(/not active/);
});
```

- [ ] **Step 2: Run the new tests**

Run: `pnpm test tests/domain/dues.test.ts -t "chargeMemberDues"`

Expected: All four new tests PASS (validations already implemented in Task 1).

- [ ] **Step 3: Commit**

```bash
git add tests/domain/dues.test.ts
git commit -m "$(cat <<'EOF'
test(domain): chargeMemberDues validation paths

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Domain — conflict tests for existing charges

**Files:**
- Test: `tests/domain/dues.test.ts`

- [ ] **Step 1: Add conflict tests**

Append inside the `describe('chargeMemberDues', …)` block:

```ts
it('throws MemberAlreadyChargedError when an OPEN charge for the same period exists', async () => {
  await chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId });
  await expect(
    chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
  ).rejects.toBeInstanceOf(MemberAlreadyChargedError);
});

it('throws MemberAlreadyChargedError when a PAID charge for the same period exists', async () => {
  const c = await chargeMemberDues(db, {
    userId: memberId,
    period: '2026-05',
    createdByUserId: adminId,
  });
  // Manually mark as paid to simulate a fully-paid existing charge
  db.update(charges).set({ status: 'paid' }).where(eq(charges.id, c.id)).run();
  await expect(
    chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
  ).rejects.toBeInstanceOf(MemberAlreadyChargedError);
});

it('throws MemberAlreadyChargedError when a CANCELLED charge for the same period exists', async () => {
  const c = await chargeMemberDues(db, {
    userId: memberId,
    period: '2026-05',
    createdByUserId: adminId,
  });
  db.update(charges).set({ status: 'cancelled' }).where(eq(charges.id, c.id)).run();
  await expect(
    chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId }),
  ).rejects.toBeInstanceOf(MemberAlreadyChargedError);
});

it('does not modify settings.lastDuesGeneratedFor', async () => {
  const before = (await getOrCreateSettings(db)).lastDuesGeneratedFor;
  await chargeMemberDues(db, { userId: memberId, period: '2026-05', createdByUserId: adminId });
  const after = (await getOrCreateSettings(db)).lastDuesGeneratedFor;
  expect(after).toBe(before);
});
```

You will also need `getOrCreateSettings` imported in this test file. Check the top of `tests/domain/dues.test.ts` — if `getOrCreateSettings` is not already imported alongside `updateMonthlyDuesAmount`, change the existing import:

```ts
import { updateMonthlyDuesAmount } from '@/server/domain/settings';
```

to:

```ts
import { getOrCreateSettings, updateMonthlyDuesAmount } from '@/server/domain/settings';
```

- [ ] **Step 2: Run the new tests**

Run: `pnpm test tests/domain/dues.test.ts -t "chargeMemberDues"`

Expected: All conflict tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/domain/dues.test.ts
git commit -m "$(cat <<'EOF'
test(domain): chargeMemberDues conflict and side-effect coverage

Asserts MemberAlreadyChargedError for open/paid/cancelled prior charges
and that settings.lastDuesGeneratedFor is left untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Domain — wallet credit auto-consumption test

**Files:**
- Test: `tests/domain/dues.test.ts`

- [ ] **Step 1: Add a credit-consumption test**

Append inside `describe('chargeMemberDues', …)`:

```ts
it('auto-consumes wallet credit when sufficient (charge is paid)', async () => {
  // Seed the member's wallet with enough credit by recording a payment
  // routed to the wallet (overpayment with no allocations).
  const { recordPayment } = await import('@/server/domain/payments');
  await recordPayment(db, {
    payerUserId: memberId,
    method: 'cash',
    amount: 5000,
    allocations: [],
    createdByUserId: adminId,
  });

  const c = await chargeMemberDues(db, {
    userId: memberId,
    period: '2026-05',
    createdByUserId: adminId,
  });
  expect(c.status).toBe('paid');
});
```

If the `recordPayment` signature in the project does not match (e.g., different property names), open `src/server/domain/payments.ts`, find the `recordPayment` export, and adapt the call. The intent is just to seed wallet credit for `memberId`.

- [ ] **Step 2: Run the test**

Run: `pnpm test tests/domain/dues.test.ts -t "auto-consumes wallet credit"`

Expected: PASS.

If it fails because the seeding helper doesn't produce wallet credit the way assumed, inspect `tests/domain/credit.test.ts` for the canonical credit-seeding pattern and reuse it.

- [ ] **Step 3: Commit**

```bash
git add tests/domain/dues.test.ts
git commit -m "$(cat <<'EOF'
test(domain): chargeMemberDues auto-consumes wallet credit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Refactor `generateMonthlyDues` to use `chargeMemberDues`

**Files:**
- Modify: `src/server/domain/dues.ts`

This task swaps the loop body without changing observable behavior. Existing `generateMonthlyDues` tests must remain green.

- [ ] **Step 1: Replace the loop body and remove the post-loop credit-consumption block**

In `src/server/domain/dues.ts`, replace the current `generateMonthlyDues` body. The full new function (after the schema/idempotency checks) becomes:

```ts
export async function generateMonthlyDues(
  db: Db,
  input: GenerateDuesInput,
): Promise<GenerateDuesResult> {
  if (!/^\d{4}-\d{2}$/.test(input.period)) {
    throw new Error(`invalid period: ${input.period}`);
  }
  const s = await getOrCreateSettings(db);
  if (s.lastDuesGeneratedFor === input.period) {
    return { createdCount: 0, period: input.period };
  }
  if (s.monthlyDuesAmount <= 0) {
    throw new Error('monthly_dues_amount must be set to a positive value before generating');
  }

  const active = db.select().from(users).where(eq(users.isActive, true)).all();

  let created = 0;
  for (const u of active) {
    try {
      await chargeMemberDues(db, {
        userId: u.id,
        period: input.period,
        createdByUserId: input.createdByUserId,
      });
      created += 1;
    } catch (err) {
      if (err instanceof MemberAlreadyChargedError) continue;
      throw err;
    }
  }

  await setLastDuesGeneratedFor(db, input.period);
  return { createdCount: created, period: input.period };
}
```

Remove the now-unused imports if any are no longer referenced (`randomUUID` and `charges` should still be used by `chargeMemberDues` defined in the same file, so keep them). The dynamic `await import('./credit')` block can be removed since `chargeMemberDues` already calls `consumeCreditForCharge`.

- [ ] **Step 2: Run the full dues test file to confirm no regressions**

Run: `pnpm test tests/domain/dues.test.ts`

Expected: All previously-passing tests (including the bulk-path tests in `describe('generateMonthlyDues')`) still PASS, plus all `chargeMemberDues` tests PASS.

- [ ] **Step 3: Run the wider test suite to catch any indirect breakage**

Run: `pnpm test`

Expected: All tests PASS. If anything fails, investigate — the refactor must be behavior-preserving.

- [ ] **Step 4: Commit**

```bash
git add src/server/domain/dues.ts
git commit -m "$(cat <<'EOF'
refactor(domain): generateMonthlyDues uses chargeMemberDues per user

Single source of truth for monthly_dues creation rules. Bulk path
swallows MemberAlreadyChargedError to remain idempotent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Regression test for ask #3 (cron does not double-charge)

**Files:**
- Test: `tests/domain/dues.test.ts`

- [ ] **Step 1: Add the regression test**

Append a new `describe` block at the bottom of `tests/domain/dues.test.ts`:

```ts
import { recordPayment } from '@/server/domain/payments';

describe('generateMonthlyDues — no double charge after manual/paid charge', () => {
  let db: TestDb;
  let adminId: string;
  let manuallyCharged: string;
  let others: string[];

  beforeEach(async () => {
    db = createTestDb();
    adminId = (await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })).id;
    manuallyCharged = (
      await createUser(db, { telegramUserId: 2, displayName: 'M', role: 'member' })
    ).id;
    others = [];
    for (let i = 0; i < 2; i++) {
      others.push(
        (
          await createUser(db, {
            telegramUserId: 100 + i,
            displayName: `O${i}`,
            role: 'member',
          })
        ).id,
      );
    }
    await updateMonthlyDuesAmount(db, 5000);
  });

  it('skips members who already have a paid monthly_dues charge for the period', async () => {
    // Manually charge M for 2026-05, then pay the charge.
    const c = await chargeMemberDues(db, {
      userId: manuallyCharged,
      period: '2026-05',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: manuallyCharged,
      method: 'cash',
      amount: c.amount,
      allocations: [{ chargeId: c.id, amount: c.amount }],
      createdByUserId: adminId,
    });
    const paid = db.select().from(charges).where(eq(charges.id, c.id)).get();
    expect(paid?.status).toBe('paid');

    // Now run the bulk cron path for the same period.
    const r = await generateMonthlyDues(db, {
      period: '2026-05',
      createdByUserId: adminId,
    });

    // Admin + two other members got charges; M already had one and is not re-charged.
    expect(r.createdCount).toBe(3);
    const mCharges = db
      .select()
      .from(charges)
      .where(
        and(
          eq(charges.userId, manuallyCharged),
          eq(charges.type, 'monthly_dues'),
          eq(charges.billingPeriod, '2026-05'),
        ),
      )
      .all();
    expect(mCharges.length).toBe(1);
    expect(mCharges[0]!.id).toBe(c.id);
    expect(mCharges[0]!.status).toBe('paid');
  });
});
```

You may also need to add `and` to the existing `drizzle-orm` import at the top of the test file. The current line is:

```ts
import { eq } from 'drizzle-orm';
```

Change to:

```ts
import { and, eq } from 'drizzle-orm';
```

- [ ] **Step 2: Run the regression test**

Run: `pnpm test tests/domain/dues.test.ts -t "no double charge"`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/domain/dues.test.ts
git commit -m "$(cat <<'EOF'
test(domain): regression — cron never double-charges a paid period

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Zod schema

**Files:**
- Modify: `src/shared/schemas.ts`

- [ ] **Step 1: Add the schema**

Append to `src/shared/schemas.ts`:

```ts
export const chargeMemberDuesSchema = z.object({
  userId: idSchema,
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
});
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `pnpm typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/schemas.ts
git commit -m "$(cat <<'EOF'
feat(schemas): chargeMemberDues input schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Extract `notifyDuesCreated` helper in `monthly-dues.ts`

**Files:**
- Modify: `src/server/jobs/monthly-dues.ts`

- [ ] **Step 1: Extract the helper and use it in the existing paid-from-wallet loop**

Edit `src/server/jobs/monthly-dues.ts`. Replace the entire file with:

```ts
import { and, eq } from 'drizzle-orm';
import cron from 'node-cron';
import type { Charge } from '@/server/domain/charges';
import { charges, users } from '@/server/db/schema';
import type { Db } from '@/server/domain/types';
import { currentBillingPeriod, generateMonthlyDues } from '@/server/domain/dues';
import { getCreditBalance } from '@/server/domain/credit';
import { getNotifier } from '../bot/notifications';
import { getOrCreateSettings } from '../domain/settings';
import { formatCents } from '@/shared/format';
import { detectFromTelegram, getMessages, isLocale } from '@/shared/i18n';

export interface RunOptions {
  now?: Date;
}

async function pickSystemAdmin(db: Db): Promise<string> {
  const admin = db.select().from(users).where(eq(users.role, 'admin')).get();
  if (!admin) throw new Error('no admin user available to attribute dues to');
  return admin.id;
}

export async function notifyDuesCreated(db: Db, charge: Charge): Promise<void> {
  if (process.env.SKIP_BOT === '1') return;
  if (charge.status === 'paid') {
    const balance = await getCreditBalance(db, charge.userId);
    await getNotifier().notifyUser(charge.userId, (recipient) => {
      const locale = isLocale(recipient.locale) ? recipient.locale : detectFromTelegram(undefined);
      return getMessages(locale).wallet.notification.autoAppliedDues(
        charge.billingPeriod ?? '',
        formatCents(charge.amount),
        formatCents(balance),
      );
    });
    return;
  }
  // status === 'open'
  await getNotifier().notifyUser(
    charge.userId,
    `🧾 Monthly dues for ${charge.billingPeriod} have been added (${formatCents(charge.amount)}). Type /balance to see total.`,
  );
}

export async function runMonthlyDuesOnce(db: Db, opts: RunOptions = {}) {
  const period = currentBillingPeriod(opts.now);
  const adminId = await pickSystemAdmin(db);
  const result = await generateMonthlyDues(db, { period, createdByUserId: adminId });

  if (result.createdCount > 0 && process.env.SKIP_BOT !== '1') {
    try {
      const settings = await getOrCreateSettings(db);
      await getNotifier().notifyAllActive(
        `📅 Monthly dues for ${period} have been added (${formatCents(settings.monthlyDuesAmount)}). Type /balance to see total.`,
      );

      const paidFromWallet = db
        .select()
        .from(charges)
        .where(
          and(
            eq(charges.type, 'monthly_dues'),
            eq(charges.billingPeriod, period),
            eq(charges.status, 'paid'),
          ),
        )
        .all();
      for (const c of paidFromWallet) {
        await notifyDuesCreated(db, c);
      }
    } catch (err) { console.error('[dues] notify failed:', err); }
  }

  return result;
}

let scheduled = false;
export function scheduleMonthlyDues(getDb: () => Db) {
  if (scheduled) return;
  scheduled = true;
  // Every day at 00:05 — idempotent so safe to oversample
  cron.schedule('5 0 * * *', async () => {
    try {
      const db = getDb();
      const r = await runMonthlyDuesOnce(db);
      if (r.createdCount > 0) {
        console.log(`[dues] generated ${r.createdCount} dues for ${r.period}`);
      }
    } catch (err) {
      console.error('[dues] generation failed:', err);
    }
  });
}
```

Note: `Charge` is exported from `src/server/domain/charges.ts` (per `export type Charge = typeof charges.$inferSelect;` at the top).

- [ ] **Step 2: Verify the project still typechecks and tests still pass**

Run: `pnpm typecheck && pnpm test`

Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/server/jobs/monthly-dues.ts
git commit -m "$(cat <<'EOF'
refactor(jobs): extract notifyDuesCreated for per-charge notifications

Shared helper used by the bulk cron run and (next commit) the new
admin per-user manual charge action.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Action — happy-path test for `chargeMemberDues` action

**Files:**
- Test: `tests/actions/charges.test.ts`

- [ ] **Step 1: Add a happy-path test**

Append to `tests/actions/charges.test.ts`, inside the existing `describe('charge actions', …)` block:

```ts
it('chargeMemberDues creates a monthly_dues charge for the given period', async () => {
  const { updateMonthlyDuesAmount } = await import('@/server/domain/settings');
  await updateMonthlyDuesAmount(db, 5000);

  const a = makeChargeActions({ getDb: () => db });
  const res = await a.chargeMemberDues({ userId: memberA, period: '2026-05' });
  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.charge.type).toBe('monthly_dues');
    expect(res.charge.userId).toBe(memberA);
    expect(res.charge.billingPeriod).toBe('2026-05');
    expect(res.charge.amount).toBe(5000);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/actions/charges.test.ts -t "chargeMemberDues"`

Expected: FAIL — `a.chargeMemberDues is not a function`.

- [ ] **Step 3: Implement the action**

Edit `src/server/actions/charges.ts`. Inside `makeChargeActions`, add a new action and include it in the returned object.

Add these imports at the top of the file (merge with existing):

```ts
import {
  createAdhocChargeSchema,
  createPotBorrowSchema,
  createSplitChargeSchema,
  chargeMemberDuesSchema,
  idSchema,
} from '@/shared/schemas';
import {
  createAdhocCharge as domainAdhoc,
  createPotBorrow as domainPotBorrow,
  createSplitCharge as domainSplit,
  cancelCharge as domainCancel,
} from '@/server/domain/charges';
import {
  chargeMemberDues as domainChargeMemberDues,
  MemberAlreadyChargedError,
} from '@/server/domain/dues';
import { notifyDuesCreated } from '@/server/jobs/monthly-dues';
```

Inside `makeChargeActions`, after `cancelCharge`, add:

```ts
const chargeMemberDues = adminAction(async ({ user, db }, input: unknown) => {
  const p = chargeMemberDuesSchema.parse(input);
  try {
    const charge = await domainChargeMemberDues(db, {
      userId: p.userId,
      period: p.period,
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

Update the returned object to include the new action:

```ts
return { createAdhocCharge, createPotBorrow, createSplitCharge, cancelCharge, chargeMemberDues };
```

And add the prod export at the bottom of the file:

```ts
export const chargeMemberDues = prod.chargeMemberDues;
```

- [ ] **Step 4: Re-export from the server-actions barrel**

Edit `src/server/actions/charges-server.ts`. Update the imports and exports:

```ts
'use server';

import {
  createAdhocCharge as a,
  createPotBorrow as p,
  createSplitCharge as s,
  cancelCharge as c,
  chargeMemberDues as cmd,
} from './charges';

export async function createAdhocCharge(input: unknown) {
  return a(input as never);
}
export async function createPotBorrow(input: unknown) {
  return p(input as never);
}
export async function createSplitCharge(input: unknown) {
  return s(input as never);
}
export async function cancelCharge(input: { id: string }) {
  return c(input);
}
export async function chargeMemberDues(input: { userId: string; period: string }) {
  return cmd(input as never);
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm test tests/actions/charges.test.ts -t "chargeMemberDues"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/charges.ts src/server/actions/charges-server.ts tests/actions/charges.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): chargeMemberDues admin action

Admin-only server action that wraps domain chargeMemberDues, returns a
structured conflict result instead of throwing on
MemberAlreadyChargedError, and fires the per-user notification.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Action — conflict and validation tests

**Files:**
- Test: `tests/actions/charges.test.ts`

- [ ] **Step 1: Add tests for conflict and Zod validation**

Append inside the `describe('charge actions', …)` block:

```ts
it('chargeMemberDues returns a structured conflict result when charge already exists', async () => {
  const { updateMonthlyDuesAmount } = await import('@/server/domain/settings');
  await updateMonthlyDuesAmount(db, 5000);

  const a = makeChargeActions({ getDb: () => db });
  const first = await a.chargeMemberDues({ userId: memberA, period: '2026-05' });
  expect(first.ok).toBe(true);

  const second = await a.chargeMemberDues({ userId: memberA, period: '2026-05' });
  expect(second.ok).toBe(false);
  if (!second.ok) {
    expect(second.reason).toBe('already_charged');
    expect(second.existingStatus).toBe('open');
    if (first.ok) expect(second.existingChargeId).toBe(first.charge.id);
  }
});

it('chargeMemberDues rejects malformed period', async () => {
  const a = makeChargeActions({ getDb: () => db });
  await expect(
    a.chargeMemberDues({ userId: memberA, period: '2026-5' }),
  ).rejects.toThrow();
  await expect(
    a.chargeMemberDues({ userId: memberA, period: 'foo' }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test tests/actions/charges.test.ts -t "chargeMemberDues"`

Expected: All `chargeMemberDues` action tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/actions/charges.test.ts
git commit -m "$(cat <<'EOF'
test(actions): chargeMemberDues conflict + zod validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: i18n keys

**Files:**
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`

- [ ] **Step 1: Add keys to English messages**

In `src/shared/i18n/messages-en.ts`, find the `members: {` block (around line 76). Inside it, before the closing `}` (right after `confirmRevoke: 'Revoke this invite? The link will stop working.',`), add:

```ts
    dues: {
      heading: 'Monthly dues',
      monthLabel: 'Month',
      chargeButton: (amount: string) => `Charge ${amount}`,
      noAmountConfigured: 'Set the monthly dues amount in Settings first.',
      alreadyCharged: (period: string, status: string) =>
        `Already charged for ${period} (${status}).`,
      successAck: 'Charge created.',
    },
```

- [ ] **Step 2: Add keys to Russian messages**

In `src/shared/i18n/messages-ru.ts`, find the `members: {` block (around line 80). Inside it, before the closing `}` (right after `confirmRevoke: 'Отозвать приглашение? Ссылка перестанет работать.',`), add:

```ts
    dues: {
      heading: 'Ежемесячный взнос',
      monthLabel: 'Месяц',
      chargeButton: (amount: string) => `Начислить ${amount}`,
      noAmountConfigured: 'Сначала задайте сумму взноса в Настройках.',
      alreadyCharged: (period: string, status: string) =>
        `Уже начислено за ${period} (${status}).`,
      successAck: 'Долг создан.',
    },
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`

Expected: no errors. (The i18n shape is structurally typed; if any key shape mismatches between EN and RU, TS will complain.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts
git commit -m "$(cat <<'EOF'
feat(i18n): members.dues.* strings for manual per-user charge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: UI — `charge-dues-form.tsx` and wire-up in page

**Files:**
- Create: `src/app/(app)/members/[id]/charge-dues-form.tsx`
- Modify: `src/app/(app)/members/[id]/page.tsx`

- [ ] **Step 1: Create the client component**

Create `src/app/(app)/members/[id]/charge-dues-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { chargeMemberDues } from '@/server/actions/charges-server';
import { useMessages } from '@/app/_i18n-provider';
import { formatCents } from '@/shared/format';

interface Props {
  userId: string;
  monthlyDuesAmount: number;
}

interface FormValues {
  period: string;
}

function currentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function ChargeDuesForm({ userId, monthlyDuesAmount }: Props) {
  const m = useMessages();
  const router = useRouter();
  const [conflict, setConflict] = useState<{ period: string; status: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, getValues } = useForm<FormValues>({
    defaultValues: { period: currentPeriod() },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setConflict(null);
      setSuccess(false);
      return chargeMemberDues({ userId, period: values.period });
    },
    onSuccess: (res) => {
      if (res.ok) {
        setSuccess(true);
        router.refresh();
        return;
      }
      setConflict({ period: getValues('period'), status: res.existingStatus });
    },
  });

  const disabled = monthlyDuesAmount <= 0;

  if (disabled) {
    return <div>{m.members.dues.noAmountConfigured}</div>;
  }

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Controller
          control={control}
          name="period"
          render={({ field }) => (
            <FormControl label={m.members.dues.monthLabel}>
              <Input
                type="month"
                value={field.value}
                onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
              />
            </FormControl>
          )}
        />
        <Button type="submit" isLoading={mutation.isPending}>
          {m.members.dues.chargeButton(formatCents(monthlyDuesAmount))}
        </Button>
      </div>
      {conflict && (
        <div style={{ color: '#b00', marginTop: 8 }}>
          {m.members.dues.alreadyCharged(conflict.period, conflict.status)}
        </div>
      )}
      {success && (
        <div style={{ color: '#080', marginTop: 8 }}>{m.members.dues.successAck}</div>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Wire it into the page**

Edit `src/app/(app)/members/[id]/page.tsx`. At the top of the file, add an import (alongside the other relative imports):

```ts
import { ChargeDuesForm } from './charge-dues-form';
```

And import `getOrCreateSettings` from settings domain (next to the existing imports from `@/server/domain/...`):

```ts
import { getOrCreateSettings } from '@/server/domain/settings';
```

Inside `MemberDetail`, after the line `const transferOptions: WalletTransferOption[] = …`, add:

```ts
  const settings = isAdmin ? await getOrCreateSettings(db) : null;
```

In the JSX, after the Panel containing `WalletSection` and before the `Panel` containing `PaymentHistoryTable`, insert:

```tsx
      {isAdmin && settings && (
        <Panel marginBottom={16}>
          <SectionHeading>{m.members.dues.heading}</SectionHeading>
          <ChargeDuesForm userId={u.id} monthlyDuesAmount={settings.monthlyDuesAmount} />
        </Panel>
      )}
```

- [ ] **Step 3: Verify typecheck and tests**

Run: `pnpm typecheck && pnpm test`

Expected: no type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/members/\[id\]/charge-dues-form.tsx src/app/\(app\)/members/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(ui): per-user manual monthly dues charge on member detail

Admin-only block with month picker (default current month) and a
"Charge {amount}" button. Shows a conflict message when a charge for
the period already exists.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Manual smoke check in the browser

This task is human-verified — no automated step. Mark it complete only after observing the behavior.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev` (in a separate terminal, or background it).

- [ ] **Step 2: Sign in as the bootstrap admin and seed a member**

In the browser, visit `http://localhost:3000`, sign in via the Telegram login widget, generate an invite for a second member, and accept it from a second Telegram account or use the existing one.

If the dev DB already has at least one non-admin member, skip this step.

- [ ] **Step 3: Confirm the dues amount is set**

Visit `/settings`. Ensure `Monthly dues amount` is a positive value (e.g., set it to `50.00` and save).

- [ ] **Step 4: Exercise the new control**

Visit `/members/<member-id>`. Expect:

1. A new "Monthly dues" block (admin-only) with a month picker and a "Charge {amount}" button.
2. Click "Charge {amount}" for the current month. The page refreshes; the new charge appears in the member's open charges table.
3. Click "Charge {amount}" again for the same month. Expect a red inline error "Already charged for {YYYY-MM} (open)."
4. Change the month to a previous month (e.g., last month). Expect a successful charge appears for that period in the table.

- [ ] **Step 5: Verify the cron does not double-charge**

In a node REPL (or via a temporary test script), invoke `runMonthlyDuesOnce(db)` for the current period and observe that the manually-charged member is NOT re-charged (or just rely on the regression test from Task 6 as evidence). Manual verification of this is optional — the test in Task 6 covers it.

- [ ] **Step 6: Stop the dev server**

Done — close `pnpm dev`.

No commit for this task.

---

## Self-review checklist (run after writing the plan)

Already performed by the plan author:

- ✅ All spec sections map to tasks: domain function (Task 1), validation (Task 2), conflict semantics (Task 3), wallet credit (Task 4), refactor (Task 5), regression / ask #3 (Task 6), Zod schema (Task 7), notification helper (Task 8), action (Task 9), action conflict (Task 10), i18n (Task 11), UI (Task 12), manual verify (Task 13).
- ✅ No "TBD" / "implement later" placeholders.
- ✅ Function names consistent (`chargeMemberDues`, `MemberAlreadyChargedError`, `notifyDuesCreated`) across all tasks.
- ✅ Return-shape consistency: `{ ok: true, charge }` vs `{ ok: false, reason: 'already_charged', existingChargeId, existingStatus }` referenced identically in Tasks 9, 10, 12.

---

## Execution

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.
