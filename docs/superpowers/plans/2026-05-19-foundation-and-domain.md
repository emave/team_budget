# Team Budget — Plan 1: Foundation & Money Domain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the technical foundation (Next.js scaffold, SQLite + Drizzle, Telegram auth, grammY bot init) and implement the complete domain layer (charges, payments, allocations, spendings, pots, splits, monthly dues, info pages) with comprehensive TDD coverage.

**Architecture:** Single Next.js (App Router) Node process. Domain logic lives in `src/server/domain/` as pure async functions that take a Drizzle transaction handle plus validated input. Bot, scheduled jobs, and web all consume the same domain functions. SQLite via `better-sqlite3` and `drizzle-orm`, WAL mode.

**Tech Stack:**
- Node 20 LTS, TypeScript 5.4+ strict
- Next.js 14 App Router, React 18
- Drizzle ORM + `better-sqlite3`
- grammY (Telegram bot) + `node-cron`
- Vitest + zod
- Base Web (`baseui`) + Styletron (scaffolded; styling details in Plan 2)
- pnpm for package management

**Reference spec:** [`docs/superpowers/specs/2026-05-19-team-budget-design.md`](../specs/2026-05-19-team-budget-design.md)

**Scope of this plan:**
- ✅ Scaffolding, db, migrations, env validation
- ✅ Telegram login + sessions (web)
- ✅ Bot bootstrap, /start with invites, /help, /menu stubs
- ✅ Full domain layer: charges, payments, spendings, pots, splits, dues, info, settings, categories
- ✅ Cron-driven monthly dues
- ✅ End-to-end integration test of the money flow
- ❌ Out of scope: rich UI pages (Plan 2), bot conversational write flows (Plan 3), notifications (Plan 3), mini app (Plan 3), Dockerfile (Plan 3)

---

## Phase A — Project Scaffolding

### Task A1: Initialize Next.js + TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.nvmrc`, `.editorconfig`

- [ ] **Step 1: Init pnpm project and install Next.js**

Run from the repo root:

```bash
echo "20" > .nvmrc
pnpm init
pnpm add next@14.2 react@18 react-dom@18
pnpm add -D typescript@5.4 @types/node @types/react @types/react-dom
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "allowJs": false,
    "forceConsistentCasingInFileNames": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
    // Required so better-sqlite3 (native bindings) and grammy load correctly in server components
    serverComponentsExternalPackages: ['better-sqlite3', 'grammy'],
  },
};
export default nextConfig;
```

- [ ] **Step 4: Write minimal `src/app/layout.tsx` and `src/app/page.tsx`**

`src/app/layout.tsx`:
```tsx
export const metadata = { title: 'Team Budget' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main style={{ padding: 24 }}>Team Budget — bootstrap OK</main>;
}
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 6: Verify build succeeds**

Run: `pnpm typecheck && pnpm build`
Expected: builds without errors. `next` warns about missing pages — fine, ignore.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "scaffold: initialize Next.js + TypeScript"
```

---

### Task A2: Add Vitest, ESLint, Prettier

**Files:**
- Create: `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc.json`, `.prettierignore`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Install dev tooling**

```bash
pnpm add -D vitest@1.6 @vitest/ui happy-dom
pnpm add -D eslint@8 eslint-config-next prettier eslint-config-prettier
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: false } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 3: Write `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'prettier'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
```

- [ ] **Step 4: Write `.prettierrc.json` and `.prettierignore`**

`.prettierrc.json`:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "semi": true
}
```

`.prettierignore`:
```
.next
node_modules
data
drizzle
pnpm-lock.yaml
```

- [ ] **Step 5: Write the smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('passes', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "next lint",
  "format": "prettier --write ."
}
```

- [ ] **Step 7: Run all checks**

```bash
pnpm typecheck && pnpm test && pnpm lint
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "scaffold: add vitest, eslint, prettier"
```

---

### Task A3: Add Drizzle + better-sqlite3

**Files:**
- Create: `drizzle.config.ts`, `src/server/db/client.ts`, `src/server/db/schema.ts`
- Create: `tests/helpers/db.ts`, `tests/db/connection.test.ts`

- [ ] **Step 1: Install Drizzle and SQLite**

```bash
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3
```

- [ ] **Step 2: Write `drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'data/team_budget.db' },
} satisfies Config;
```

- [ ] **Step 3: Write `src/server/db/schema.ts` (initial empty barrel)**

```ts
// All table definitions are added in Phase B. This file is the single source of
// truth for the schema and what drizzle-kit reads.
export {};
```

- [ ] **Step 4: Write `src/server/db/client.ts`**

```ts
import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL ?? 'data/team_budget.db';
    const sqlite = new Database(url);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 5: Write `tests/helpers/db.ts`** — fresh in-memory db per test

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '@/server/db/schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  return db;
}
```

- [ ] **Step 6: Write a connection smoke test**

`tests/db/connection.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

describe('better-sqlite3', () => {
  it('opens an in-memory database', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE t (x INTEGER)');
    db.prepare('INSERT INTO t VALUES (1)').run();
    const row = db.prepare('SELECT x FROM t').get() as { x: number };
    expect(row.x).toBe(1);
  });
});
```

- [ ] **Step 7: Run test**

Run: `pnpm test`
Expected: smoke test + connection test pass. (`createTestDb` itself isn't exercised yet — it'll fail to migrate until Phase B is done. That's expected — we'll wire it into real tests in Phase B.)

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "scaffold: add drizzle-orm + better-sqlite3"
```

---

### Task A4: Add grammY, node-cron, zod, env validation

**Files:**
- Create: `src/server/env.ts`, `tests/env.test.ts`
- Create: `.env.example`

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add grammy node-cron zod
pnpm add -D @types/node-cron
```

- [ ] **Step 2: Write `src/server/env.ts`** — single source of validated env

```ts
import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('data/team_budget.db'),
  BOT_TOKEN: z.string().min(10),
  BOT_USERNAME: z.string().min(1),
  BOOTSTRAP_ADMIN_TELEGRAM_ID: z.coerce.number().int().positive(),
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  CURRENCY: z.string().length(3).default('USD'),
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | null = null;

export function env(): Env {
  if (!_env) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
      );
    }
    _env = parsed.data;
  }
  return _env;
}

export function envForTest(overrides: Partial<Env> = {}): Env {
  return EnvSchema.parse({
    NODE_ENV: 'test',
    BOT_TOKEN: 'test:0123456789',
    BOT_USERNAME: 'test_bot',
    BOOTSTRAP_ADMIN_TELEGRAM_ID: '1',
    NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
    CURRENCY: 'USD',
    SESSION_SECRET: 'a'.repeat(32),
    ...overrides,
  });
}
```

- [ ] **Step 3: Write `.env.example`**

```
NODE_ENV=development
DATABASE_URL=data/team_budget.db
BOT_TOKEN=put-your-bot-token-here
BOT_USERNAME=YourTeamBudgetBot
BOOTSTRAP_ADMIN_TELEGRAM_ID=123456789
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CURRENCY=USD
SESSION_SECRET=change-this-to-at-least-32-random-chars
```

- [ ] **Step 4: Write env validation test**

`tests/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { envForTest } from '@/server/env';

describe('env', () => {
  it('parses valid env', () => {
    const e = envForTest();
    expect(e.BOT_USERNAME).toBe('test_bot');
    expect(e.CURRENCY).toBe('USD');
  });

  it('rejects short session secret', () => {
    expect(() => envForTest({ SESSION_SECRET: 'short' })).toThrow();
  });
});
```

- [ ] **Step 5: Run test**

Run: `pnpm test`
Expected: env tests pass.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "scaffold: add env validation and bot/cron/zod deps"
```

---

### Task A5: Base Web + Styletron SSR setup

**Files:**
- Create: `src/ui/theme.ts`, `src/app/providers.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install Base Web and Styletron**

```bash
pnpm add baseui styletron-engine-atomic styletron-react @phosphor-icons/react
```

- [ ] **Step 2: Write `src/ui/theme.ts`**

```ts
import { createLightTheme, createDarkTheme } from 'baseui';

export const lightTheme = createLightTheme();
export const darkTheme = createDarkTheme();
```

- [ ] **Step 3: Write `src/app/providers.tsx`**

```tsx
'use client';

import { useMemo, type ReactNode } from 'react';
import { Client as Styletron } from 'styletron-engine-atomic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { lightTheme } from '@/ui/theme';

export function Providers({ children }: { children: ReactNode }) {
  const engine = useMemo(() => new Styletron(), []);
  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={lightTheme}>{children}</BaseProvider>
    </StyletronProvider>
  );
}
```

- [ ] **Step 4: Update `src/app/layout.tsx`**

```tsx
import { Providers } from './providers';

export const metadata = { title: 'Team Budget' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: builds successfully. (Styletron SSR hydration warnings are addressed in Plan 2 when we add the real SSR stylesheet collector — for now, the client-side mount is sufficient.)

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "scaffold: add base web + styletron providers"
```

---

### Task A6: Boot module skeleton

**Files:**
- Create: `src/server/boot.ts`
- Create: `tests/boot.test.ts`

- [ ] **Step 1: Write `src/server/boot.ts`**

```ts
import 'server-only';
import { env } from './env';

type BootState = 'pending' | 'booting' | 'ready' | 'failed';

let state: BootState = 'pending';
let bootPromise: Promise<void> | null = null;

async function doBoot() {
  state = 'booting';
  try {
    env(); // validate env early
    // bot + cron startup happens in Phase D/G; this is the seam
    state = 'ready';
  } catch (err) {
    state = 'failed';
    throw err;
  }
}

export function getBootState(): BootState {
  return state;
}

export function bootOnce(): Promise<void> {
  if (!bootPromise) bootPromise = doBoot();
  return bootPromise;
}
```

- [ ] **Step 2: Write the boot test**

`tests/boot.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('boot', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.BOT_TOKEN = 'test:0123456789';
    process.env.BOT_USERNAME = 'test_bot';
    process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.SESSION_SECRET = 'a'.repeat(32);
  });

  it('reaches ready state', async () => {
    const { bootOnce, getBootState } = await import('@/server/boot');
    await bootOnce();
    expect(getBootState()).toBe('ready');
  });

  it('is idempotent', async () => {
    const { bootOnce } = await import('@/server/boot');
    const p1 = bootOnce();
    const p2 = bootOnce();
    expect(p1).toBe(p2);
    await p1;
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: boot tests pass.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "scaffold: add boot module skeleton"
```

---

## Phase B — Database Schema Baseline

All tables defined in one schema file, then one initial migration generated. The schema follows §4 of the spec exactly.

### Task B1: Define all tables in schema.ts

**Files:**
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Write the full schema**

`src/server/db/schema.ts`:
```ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// All money values are stored as integers in minor units (cents).

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  telegramUserId: integer('telegram_user_id').notNull().unique(),
  telegramUsername: text('telegram_username'),
  displayName: text('display_name').notNull(),
  photoUrl: text('photo_url'),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  deactivatedAt: text('deactivated_at'),
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
  displayNameHint: text('display_name_hint'),
  consumedByUserId: text('consumed_by_user_id').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  consumedAt: text('consumed_at'),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(), // always 1
  monthlyDuesAmount: integer('monthly_dues_amount').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  dueDay: integer('due_day').notNull().default(1),
  lastDuesGeneratedFor: text('last_dues_generated_for'),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const charges = sqliteTable('charges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type', {
    enum: ['monthly_dues', 'out_of_bounds', 'adhoc', 'pot_borrow'],
  }).notNull(),
  amount: integer('amount').notNull(),
  description: text('description').notNull(),
  billingPeriod: text('billing_period'),
  groupId: text('group_id'),
  sourcePot: text('source_pot', { enum: ['cash', 'card'] }),
  status: text('status', { enum: ['open', 'paid', 'cancelled'] }).notNull().default('open'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  payerUserId: text('payer_user_id').notNull().references(() => users.id),
  method: text('method', { enum: ['cash', 'card'] }).notNull(),
  amount: integer('amount').notNull(),
  note: text('note'),
  receivedAt: text('received_at').notNull(),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const paymentAllocations = sqliteTable('payment_allocations', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  chargeId: text('charge_id').notNull().references(() => charges.id),
  amount: integer('amount').notNull(),
});

export const spendings = sqliteTable('spendings', {
  id: text('id').primaryKey(),
  pot: text('pot', { enum: ['cash', 'card'] }).notNull(),
  amount: integer('amount').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  description: text('description').notNull(),
  occurredAt: text('occurred_at').notNull(),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const infoPages = sqliteTable('info_pages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedByUserId: text('updated_by_user_id').notNull().references(() => users.id),
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "db: define full schema (users, charges, payments, spendings, etc.)"
```

---

### Task B2: Generate the initial migration

**Files:**
- Create: `drizzle/0000_*.sql` (generated)
- Create: `drizzle/meta/_journal.json` (generated)

- [ ] **Step 1: Add drizzle script**

Edit `package.json` scripts:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx scripts/migrate.ts",
"db:studio": "drizzle-kit studio"
```

Install `tsx`:
```bash
pnpm add -D tsx
```

- [ ] **Step 2: Generate migration**

```bash
pnpm db:generate
```

Expected: a new file in `drizzle/` is created, plus `drizzle/meta/_journal.json`.

- [ ] **Step 3: Write the migrate script**

`scripts/migrate.ts`:
```ts
import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const url = process.env.DATABASE_URL ?? 'data/team_budget.db';
mkdirSync(dirname(url), { recursive: true });
const sqlite = new Database(url);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: 'drizzle' });
console.log('Migrations applied to', url);
sqlite.close();
```

Install dotenv: `pnpm add -D dotenv`

- [ ] **Step 4: Apply migration locally**

```bash
mkdir -p data
pnpm db:migrate
```

Expected: prints `Migrations applied to data/team_budget.db`. The `data/team_budget.db` file exists.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "db: generate initial migration and add migrate script"
```

---

### Task B3: Wire test DB helper to migrations

**Files:**
- Modify: `tests/helpers/db.ts` (already exists from A3, verify it works)
- Create: `tests/db/schema.test.ts`

- [ ] **Step 1: Write a schema smoke test**

`tests/db/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../helpers/db';
import { users } from '@/server/db/schema';

describe('schema (in-memory)', () => {
  it('migrates and accepts a user insert', () => {
    const db = createTestDb();
    db.insert(users).values({
      id: 'u-1',
      telegramUserId: 100,
      displayName: 'Alice',
      role: 'admin',
    }).run();

    const rows = db.select().from(users).all();
    expect(rows.length).toBe(1);
    expect(rows[0]?.role).toBe('admin');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: schema test passes (along with all prior tests).

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "tests: verify in-memory schema setup"
```

---

## Phase C — Auth & Users

### Task C1: Users domain

**Files:**
- Create: `src/server/domain/users.ts`, `src/server/domain/types.ts`
- Create: `tests/domain/users.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/users.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import {
  createUser,
  getUserByTelegramId,
  deactivateUser,
  reactivateUser,
  changeRole,
} from '@/server/domain/users';

describe('users domain', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a member user', async () => {
    const u = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    expect(u.id).toBeDefined();
    expect(u.role).toBe('member');
    expect(u.isActive).toBe(true);
  });

  it('looks up by telegram id', async () => {
    await createUser(db, { telegramUserId: 42, displayName: 'Alice', role: 'member' });
    const u = await getUserByTelegramId(db, 42);
    expect(u?.displayName).toBe('Alice');
  });

  it('returns undefined for unknown telegram id', async () => {
    const u = await getUserByTelegramId(db, 999);
    expect(u).toBeUndefined();
  });

  it('deactivates and reactivates a user', async () => {
    const created = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    const off = await deactivateUser(db, created.id);
    expect(off.isActive).toBe(false);
    expect(off.deactivatedAt).toBeTruthy();
    const on = await reactivateUser(db, created.id);
    expect(on.isActive).toBe(true);
    expect(on.deactivatedAt).toBeNull();
  });

  it('changes role', async () => {
    const u = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    const promoted = await changeRole(db, u.id, 'admin');
    expect(promoted.role).toBe('admin');
  });

  it('rejects duplicate telegram id', async () => {
    await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'member' });
    await expect(
      createUser(db, { telegramUserId: 42, displayName: 'B', role: 'member' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/domain/users.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write `src/server/domain/types.ts`**

```ts
import type { drizzle } from 'drizzle-orm/better-sqlite3';
import type * as schema from '@/server/db/schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;
```

- [ ] **Step 4: Write `src/server/domain/users.ts`**

```ts
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { users } from '@/server/db/schema';
import type { Db } from './types';

export type Role = 'admin' | 'member';

export interface CreateUserInput {
  telegramUserId: number;
  telegramUsername?: string | null;
  displayName: string;
  photoUrl?: string | null;
  role: Role;
}

export async function createUser(db: Db, input: CreateUserInput) {
  const id = randomUUID();
  db.insert(users)
    .values({
      id,
      telegramUserId: input.telegramUserId,
      telegramUsername: input.telegramUsername ?? null,
      displayName: input.displayName,
      photoUrl: input.photoUrl ?? null,
      role: input.role,
      isActive: true,
    })
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user creation failed');
  return row;
}

export async function getUserByTelegramId(db: Db, telegramUserId: number) {
  return db.select().from(users).where(eq(users.telegramUserId, telegramUserId)).get();
}

export async function getUserById(db: Db, id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function deactivateUser(db: Db, id: string) {
  const now = new Date().toISOString();
  db.update(users)
    .set({ isActive: false, deactivatedAt: now })
    .where(eq(users.id, id))
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}

export async function reactivateUser(db: Db, id: string) {
  db.update(users)
    .set({ isActive: true, deactivatedAt: null })
    .where(eq(users.id, id))
    .run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}

export async function changeRole(db: Db, id: string, role: Role) {
  db.update(users).set({ role }).where(eq(users.id, id)).run();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new Error('user not found');
  return row;
}

export async function listActiveMembers(db: Db) {
  return db.select().from(users).where(eq(users.isActive, true)).all();
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/domain/users.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "domain: users (create, lookup, deactivate, role change)"
```

---

### Task C2: Telegram login widget signature verification

**Files:**
- Create: `src/server/auth/telegram.ts`
- Create: `tests/auth/telegram.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/auth/telegram.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { verifyTelegramAuth, type TelegramAuthData } from '@/server/auth/telegram';

function sign(data: TelegramAuthData, botToken: string): TelegramAuthData {
  const secretKey = createHash('sha256').update(botToken).digest();
  const fields = Object.entries(data)
    .filter(([k, v]) => k !== 'hash' && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const hash = createHmac('sha256', secretKey).update(fields).digest('hex');
  return { ...data, hash };
}

describe('verifyTelegramAuth', () => {
  const BOT_TOKEN = 'test:0123456789';
  const now = Math.floor(Date.now() / 1000);

  it('accepts a valid signature', () => {
    const data = sign(
      { id: 42, first_name: 'Alice', auth_date: now },
      BOT_TOKEN,
    );
    const result = verifyTelegramAuth(data, BOT_TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(42);
  });

  it('rejects tampered payload', () => {
    const data = sign({ id: 42, first_name: 'Alice', auth_date: now }, BOT_TOKEN);
    const tampered = { ...data, first_name: 'Bob' };
    const result = verifyTelegramAuth(tampered, BOT_TOKEN);
    expect(result.ok).toBe(false);
  });

  it('rejects expired auth_date (>1 day old)', () => {
    const old = now - 60 * 60 * 25;
    const data = sign({ id: 42, first_name: 'Alice', auth_date: old }, BOT_TOKEN);
    const result = verifyTelegramAuth(data, BOT_TOKEN);
    expect(result.ok).toBe(false);
  });

  it('rejects missing hash', () => {
    const result = verifyTelegramAuth(
      { id: 42, first_name: 'Alice', auth_date: now },
      BOT_TOKEN,
    );
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/auth/telegram.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/auth/telegram.ts`**

```ts
import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash?: string;
}

export type VerifyResult =
  | { ok: true; data: Required<Omit<TelegramAuthData, 'hash'>> & { hash: string } }
  | { ok: false; reason: string };

const MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day

export function verifyTelegramAuth(input: TelegramAuthData, botToken: string): VerifyResult {
  const { hash, ...rest } = input;
  if (!hash) return { ok: false, reason: 'missing hash' };

  const age = Math.floor(Date.now() / 1000) - input.auth_date;
  if (age > MAX_AGE_SECONDS) return { ok: false, reason: 'auth_date too old' };

  const secret = createHash('sha256').update(botToken).digest();
  const dataCheck = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const expected = createHmac('sha256', secret).update(dataCheck).digest();
  const got = Buffer.from(hash, 'hex');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true, data: { ...input, hash } as VerifyResult extends { ok: true; data: infer D } ? D : never };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/auth/telegram.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "auth: telegram login widget signature verification"
```

---

### Task C3: Sessions domain

**Files:**
- Create: `src/server/domain/sessions.ts`
- Create: `tests/domain/sessions.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/sessions.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createSession,
  getSession,
  refreshSession,
  deleteSession,
} from '@/server/domain/sessions';

describe('sessions domain', () => {
  let db: TestDb;
  let userId: string;
  beforeEach(async () => {
    db = createTestDb();
    const u = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Alice',
      role: 'admin',
    });
    userId = u.id;
  });

  it('creates a session with a token and expiry ~30d', async () => {
    const s = await createSession(db, userId);
    expect(s.token).toMatch(/^[a-f0-9]{64}$/);
    const ms = new Date(s.expiresAt).getTime() - Date.now();
    expect(ms).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('looks up an active session', async () => {
    const created = await createSession(db, userId);
    const found = await getSession(db, created.token);
    expect(found?.userId).toBe(userId);
  });

  it('returns undefined for expired session', async () => {
    const s = await createSession(db, userId, { ttlMs: -1000 });
    const found = await getSession(db, s.token);
    expect(found).toBeUndefined();
  });

  it('refreshes a session, extending expiry', async () => {
    const s = await createSession(db, userId, { ttlMs: 60_000 });
    const refreshed = await refreshSession(db, s.token);
    expect(new Date(refreshed!.expiresAt).getTime()).toBeGreaterThan(
      new Date(s.expiresAt).getTime(),
    );
  });

  it('deletes a session', async () => {
    const s = await createSession(db, userId);
    await deleteSession(db, s.token);
    expect(await getSession(db, s.token)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/domain/sessions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/domain/sessions.ts`**

```ts
import { eq, gt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { sessions } from '@/server/db/schema';
import type { Db } from './types';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: Db,
  userId: string,
  opts: { ttlMs?: number } = {},
) {
  const token = randomBytes(32).toString('hex');
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  db.insert(sessions).values({ token, userId, expiresAt }).run();
  return { token, userId, expiresAt };
}

export async function getSession(db: Db, token: string) {
  const now = new Date().toISOString();
  const row = db.select().from(sessions).where(eq(sessions.token, token)).get();
  return row && row.expiresAt > now ? row : undefined;
}

export async function refreshSession(db: Db, token: string) {
  const row = await getSession(db, token);
  if (!row) return undefined;
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS).toISOString();
  db.update(sessions).set({ expiresAt }).where(eq(sessions.token, token)).run();
  return { ...row, expiresAt };
}

export async function deleteSession(db: Db, token: string) {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

export async function pruneExpiredSessions(db: Db) {
  const now = new Date().toISOString();
  db.delete(sessions).where(gt(sessions.expiresAt, now)).run();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/sessions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: sessions (create, lookup, refresh, delete)"
```

---

### Task C4: Bootstrap admin seed

**Files:**
- Create: `src/server/domain/bootstrap.ts`
- Create: `tests/domain/bootstrap.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/bootstrap.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { getUserByTelegramId, createUser } from '@/server/domain/users';

describe('bootstrap admin', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates the admin on first call', async () => {
    const result = await bootstrapAdminIfNeeded(db, {
      telegramUserId: 100,
      displayName: 'Owner',
    });
    expect(result.created).toBe(true);
    const u = await getUserByTelegramId(db, 100);
    expect(u?.role).toBe('admin');
  });

  it('is a no-op if the user already exists', async () => {
    await createUser(db, { telegramUserId: 100, displayName: 'Owner', role: 'member' });
    const result = await bootstrapAdminIfNeeded(db, {
      telegramUserId: 100,
      displayName: 'Owner',
    });
    expect(result.created).toBe(false);
    const u = await getUserByTelegramId(db, 100);
    expect(u?.role).toBe('member'); // unchanged
  });

  it('is a no-op if any admin already exists', async () => {
    await createUser(db, { telegramUserId: 200, displayName: 'OtherAdmin', role: 'admin' });
    const result = await bootstrapAdminIfNeeded(db, {
      telegramUserId: 100,
      displayName: 'Owner',
    });
    expect(result.created).toBe(false);
    expect(await getUserByTelegramId(db, 100)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/domain/bootstrap.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/domain/bootstrap.ts`**

```ts
import { eq } from 'drizzle-orm';
import { users } from '@/server/db/schema';
import type { Db } from './types';
import { createUser, getUserByTelegramId } from './users';

export interface BootstrapInput {
  telegramUserId: number;
  displayName: string;
  telegramUsername?: string | null;
  photoUrl?: string | null;
}

export async function bootstrapAdminIfNeeded(
  db: Db,
  input: BootstrapInput,
): Promise<{ created: boolean }> {
  const existingAdmin = db.select().from(users).where(eq(users.role, 'admin')).get();
  if (existingAdmin) return { created: false };

  const existingUser = await getUserByTelegramId(db, input.telegramUserId);
  if (existingUser) return { created: false };

  await createUser(db, {
    telegramUserId: input.telegramUserId,
    displayName: input.displayName,
    telegramUsername: input.telegramUsername ?? null,
    photoUrl: input.photoUrl ?? null,
    role: 'admin',
  });
  return { created: true };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/bootstrap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: bootstrap admin seed"
```

---

### Task C5: Login page + Telegram callback route

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/api/auth/telegram/callback/route.ts`
- Create: `src/server/auth/session-cookie.ts`
- Create: `tests/auth/session-cookie.test.ts`

- [ ] **Step 1: Write session-cookie helper test**

`tests/auth/session-cookie.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { signCookie, verifyCookie } from '@/server/auth/session-cookie';

const SECRET = 'a'.repeat(32);

describe('session cookie signing', () => {
  it('round-trips a token', () => {
    const signed = signCookie('token123', SECRET);
    const verified = verifyCookie(signed, SECRET);
    expect(verified).toBe('token123');
  });

  it('rejects a tampered cookie', () => {
    const signed = signCookie('token123', SECRET);
    const tampered = signed.replace('token123', 'token456');
    expect(verifyCookie(tampered, SECRET)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyCookie('not.a.cookie', SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/auth/session-cookie.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/auth/session-cookie.ts`**

```ts
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signCookie(token: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(token).digest('hex');
  return `${token}.${sig}`;
}

export function verifyCookie(value: string, secret: string): string | null {
  const idx = value.lastIndexOf('.');
  if (idx <= 0) return null;
  const token = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(token).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return token;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/auth/session-cookie.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/app/login/page.tsx`**

```tsx
import { env } from '@/server/env';

export default function LoginPage() {
  const e = env();
  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Team Budget — Sign in</h1>
      <p>Sign in with your Telegram account to access the team budget.</p>
      <script async src="https://telegram.org/js/telegram-widget.js?22" />
      <div
        dangerouslySetInnerHTML={{
          __html: `
          <script async src="https://telegram.org/js/telegram-widget.js?22"
            data-telegram-login="${e.BOT_USERNAME}"
            data-size="large"
            data-auth-url="${e.NEXT_PUBLIC_BASE_URL}/api/auth/telegram/callback"
            data-request-access="write"></script>
        `,
        }}
      />
    </main>
  );
}
```

- [ ] **Step 6: Write `src/app/api/auth/telegram/callback/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/server/env';
import { verifyTelegramAuth, type TelegramAuthData } from '@/server/auth/telegram';
import { signCookie } from '@/server/auth/session-cookie';
import { getDb } from '@/server/db/client';
import { getUserByTelegramId } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const input: TelegramAuthData = {
    id: Number(sp.get('id')),
    first_name: sp.get('first_name') ?? undefined,
    last_name: sp.get('last_name') ?? undefined,
    username: sp.get('username') ?? undefined,
    photo_url: sp.get('photo_url') ?? undefined,
    auth_date: Number(sp.get('auth_date')),
    hash: sp.get('hash') ?? undefined,
  };

  const e = env();
  const verify = verifyTelegramAuth(input, e.BOT_TOKEN);
  if (!verify.ok) {
    return new NextResponse(`Auth failed: ${verify.reason}`, { status: 401 });
  }

  const db = getDb();
  const user = await getUserByTelegramId(db, input.id);
  if (!user) {
    return new NextResponse(
      'You are not a team member. Ask your admin to send you an invite link via the bot.',
      { status: 403 },
    );
  }

  const session = await createSession(db, user.id);
  const cookieValue = signCookie(session.token, e.SESSION_SECRET);
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set('tb_session', cookieValue, {
    httpOnly: true,
    secure: e.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.expiresAt),
  });
  return res;
}
```

- [ ] **Step 7: Verify build**

Run: `pnpm typecheck && pnpm build`
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "auth: telegram login page and callback route"
```

---

### Task C6: Web auth middleware

**Files:**
- Create: `src/server/auth/current-user.ts`
- Create: `tests/auth/current-user.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/auth/current-user.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSession } from '@/server/domain/sessions';
import { signCookie } from '@/server/auth/session-cookie';
import { resolveCurrentUser } from '@/server/auth/current-user';

const SECRET = 'a'.repeat(32);

describe('resolveCurrentUser', () => {
  let db: TestDb;
  let userId: string;
  let validCookie: string;

  beforeEach(async () => {
    db = createTestDb();
    const u = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Alice',
      role: 'member',
    });
    userId = u.id;
    const s = await createSession(db, userId);
    validCookie = signCookie(s.token, SECRET);
  });

  it('returns the user for a valid cookie', async () => {
    const r = await resolveCurrentUser(db, validCookie, SECRET);
    expect(r?.id).toBe(userId);
  });

  it('returns null for missing cookie', async () => {
    const r = await resolveCurrentUser(db, undefined, SECRET);
    expect(r).toBeNull();
  });

  it('returns null for tampered cookie', async () => {
    const r = await resolveCurrentUser(db, validCookie + 'x', SECRET);
    expect(r).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    const fake = signCookie('not-a-real-token', SECRET);
    const r = await resolveCurrentUser(db, fake, SECRET);
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/auth/current-user.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/auth/current-user.ts`**

```ts
import 'server-only';
import type { Db } from '@/server/domain/types';
import { verifyCookie } from './session-cookie';
import { getSession } from '@/server/domain/sessions';
import { getUserById } from '@/server/domain/users';

export async function resolveCurrentUser(
  db: Db,
  cookieValue: string | undefined,
  secret: string,
) {
  if (!cookieValue) return null;
  const token = verifyCookie(cookieValue, secret);
  if (!token) return null;
  const session = await getSession(db, token);
  if (!session) return null;
  const user = await getUserById(db, session.userId);
  return user ?? null;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/auth/current-user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "auth: resolveCurrentUser helper"
```

---

## Phase D — Bot Foundation

### Task D1: Invites domain

**Files:**
- Create: `src/server/domain/invites.ts`
- Create: `tests/domain/invites.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/domain/invites.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createInvite,
  findOpenInviteByToken,
  consumeInvite,
} from '@/server/domain/invites';

describe('invites', () => {
  let db: TestDb;
  let adminId: string;

  beforeEach(async () => {
    db = createTestDb();
    const a = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Admin',
      role: 'admin',
    });
    adminId = a.id;
  });

  it('creates an invite with a url-safe token', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId, displayNameHint: 'Vasya' });
    expect(inv.token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(inv.consumedByUserId).toBeNull();
  });

  it('finds an open invite by token', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const found = await findOpenInviteByToken(db, inv.token);
    expect(found?.id).toBe(inv.id);
  });

  it('returns undefined for already-consumed invite', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const newUser = await createUser(db, {
      telegramUserId: 99,
      displayName: 'Vasya',
      role: 'member',
    });
    await consumeInvite(db, inv.token, newUser.id);
    const found = await findOpenInviteByToken(db, inv.token);
    expect(found).toBeUndefined();
  });

  it('consume marks the invite consumed and sets consumed_at', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const newUser = await createUser(db, {
      telegramUserId: 99,
      displayName: 'Vasya',
      role: 'member',
    });
    const consumed = await consumeInvite(db, inv.token, newUser.id);
    expect(consumed.consumedByUserId).toBe(newUser.id);
    expect(consumed.consumedAt).toBeTruthy();
  });

  it('consuming twice throws', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId });
    const u1 = await createUser(db, {
      telegramUserId: 99,
      displayName: 'A',
      role: 'member',
    });
    const u2 = await createUser(db, {
      telegramUserId: 100,
      displayName: 'B',
      role: 'member',
    });
    await consumeInvite(db, inv.token, u1.id);
    await expect(consumeInvite(db, inv.token, u2.id)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/domain/invites.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/domain/invites.ts`**

```ts
import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { invites } from '@/server/db/schema';
import type { Db } from './types';

export interface CreateInviteInput {
  createdByUserId: string;
  displayNameHint?: string | null;
}

export async function createInvite(db: Db, input: CreateInviteInput) {
  const id = randomUUID();
  const token = randomBytes(16).toString('base64url');
  db.insert(invites)
    .values({
      id,
      token,
      createdByUserId: input.createdByUserId,
      displayNameHint: input.displayNameHint ?? null,
    })
    .run();
  const row = db.select().from(invites).where(eq(invites.id, id)).get();
  if (!row) throw new Error('invite creation failed');
  return row;
}

export async function findOpenInviteByToken(db: Db, token: string) {
  return db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.consumedByUserId)))
    .get();
}

export async function consumeInvite(db: Db, token: string, consumedByUserId: string) {
  const open = await findOpenInviteByToken(db, token);
  if (!open) throw new Error('invite not found or already consumed');
  const now = new Date().toISOString();
  db.update(invites)
    .set({ consumedByUserId, consumedAt: now })
    .where(eq(invites.id, open.id))
    .run();
  const row = db.select().from(invites).where(eq(invites.id, open.id)).get();
  if (!row) throw new Error('invite vanished after consume');
  return row;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/invites.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: invites (create, find, consume)"
```

---

### Task D2: grammY bot setup with auth middleware

**Files:**
- Create: `src/server/bot/index.ts`
- Create: `src/server/bot/context.ts`
- Create: `src/server/bot/middleware.ts`
- Create: `tests/bot/middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/bot/middleware.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { identifyUser, type BotContext } from '@/server/bot/middleware';

function makeUpdate(fromId: number, text: string) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text,
    },
  };
}

describe('identifyUser middleware', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('attaches a known user to ctx', async () => {
    const u = await createUser(db, {
      telegramUserId: 42,
      displayName: 'Alice',
      role: 'member',
    });
    const bot = new Bot<BotContext>('123:abc');
    bot.use((ctx, next) => {
      ctx.db = db;
      return next();
    });
    bot.use(identifyUser);
    let captured: BotContext['currentUser'] = null;
    bot.on('message', (ctx) => {
      captured = ctx.currentUser;
    });
    await bot.handleUpdate(makeUpdate(42, '/anything'));
    expect(captured?.id).toBe(u.id);
  });

  it('leaves currentUser null for unknown sender', async () => {
    const bot = new Bot<BotContext>('123:abc');
    bot.use((ctx, next) => {
      ctx.db = db;
      return next();
    });
    bot.use(identifyUser);
    let captured: BotContext['currentUser'] = undefined as never;
    bot.on('message', (ctx) => {
      captured = ctx.currentUser;
    });
    await bot.handleUpdate(makeUpdate(999, '/anything'));
    expect(captured).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/bot/middleware.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/bot/context.ts`**

```ts
import type { Context } from 'grammy';
import type { Db } from '@/server/domain/types';
import type { users } from '@/server/db/schema';

export interface BotContextProps {
  db: Db;
  currentUser: typeof users.$inferSelect | null;
}

export type BotContext = Context & BotContextProps;
```

- [ ] **Step 4: Write `src/server/bot/middleware.ts`**

```ts
import type { NextFunction } from 'grammy';
import type { BotContext } from './context';
import { getUserByTelegramId } from '@/server/domain/users';

export type { BotContext } from './context';

export async function identifyUser(ctx: BotContext, next: NextFunction) {
  ctx.currentUser = null;
  const tgId = ctx.from?.id;
  if (tgId) {
    const user = await getUserByTelegramId(ctx.db, tgId);
    ctx.currentUser = user ?? null;
  }
  await next();
}

export async function requireAdmin(ctx: BotContext, next: NextFunction) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  await next();
}

export async function requireMember(ctx: BotContext, next: NextFunction) {
  if (!ctx.currentUser) {
    await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
    return;
  }
  await next();
}
```

- [ ] **Step 5: Write `src/server/bot/index.ts`** (skeleton)

```ts
import 'server-only';
import { Bot } from 'grammy';
import { env } from '@/server/env';
import { getDb } from '@/server/db/client';
import { identifyUser, type BotContext } from './middleware';

let _bot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!_bot) {
    _bot = new Bot<BotContext>(env().BOT_TOKEN);
    _bot.use((ctx, next) => {
      ctx.db = getDb();
      return next();
    });
    _bot.use(identifyUser);
    // Command handlers are registered in subsequent tasks.
  }
  return _bot;
}

export async function startBot() {
  const bot = getBot();
  await bot.start({ drop_pending_updates: true });
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm test tests/bot/middleware.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "bot: grammy setup + identifyUser middleware"
```

---

### Task D3: /start handler with invite + bootstrap

**Files:**
- Create: `src/server/bot/handlers/start.ts`
- Create: `tests/bot/start.test.ts`
- Modify: `src/server/bot/index.ts`

- [ ] **Step 1: Write the failing tests**

`tests/bot/start.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createInvite } from '@/server/domain/invites';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerStartHandler } from '@/server/bot/handlers/start';

function makeStart(fromId: number, payload?: string) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'Vasya' },
      chat: { id: fromId, type: 'private' as const, first_name: 'Vasya' },
      text: payload ? `/start ${payload}` : '/start',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 6 }],
    },
  };
}

function makeBot(db: TestDb, opts: { bootstrapAdminId?: number } = {}) {
  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc');
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({
        ok: true,
        result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' },
      } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => {
    ctx.db = db;
    return next();
  });
  bot.use(identifyUser);
  registerStartHandler(bot, { bootstrapAdminTelegramId: opts.bootstrapAdminId ?? -1 });
  return { bot, replies };
}

describe('/start', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    const a = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Owner',
      role: 'admin',
    });
    adminId = a.id;
  });

  it('greets an existing user', async () => {
    const { bot, replies } = makeBot(db);
    await bot.handleUpdate(makeStart(1));
    expect(replies.join('\n')).toMatch(/welcome back/i);
  });

  it('consumes an invite for unknown user and creates the member', async () => {
    const inv = await createInvite(db, { createdByUserId: adminId, displayNameHint: 'Vasya' });
    const { bot, replies } = makeBot(db);
    await bot.handleUpdate(makeStart(99, `invite_${inv.token}`));
    expect(replies.join('\n')).toMatch(/welcome to the team/i);

    // verify user created
    const { getUserByTelegramId } = await import('@/server/domain/users');
    const u = await getUserByTelegramId(db, 99);
    expect(u?.role).toBe('member');
  });

  it('rejects unknown user without invite', async () => {
    const { bot, replies } = makeBot(db);
    await bot.handleUpdate(makeStart(99));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('bootstraps admin when telegram id matches', async () => {
    const db2 = createTestDb(); // fresh, no users
    const { bot, replies } = makeBot(db2, { bootstrapAdminId: 555 });
    await bot.handleUpdate(makeStart(555));
    expect(replies.join('\n')).toMatch(/welcome, admin/i);
    const { getUserByTelegramId } = await import('@/server/domain/users');
    const u = await getUserByTelegramId(db2, 555);
    expect(u?.role).toBe('admin');
  });

  it('does not bootstrap if an admin already exists', async () => {
    // adminId already created in beforeEach
    const { bot, replies } = makeBot(db, { bootstrapAdminId: 555 });
    await bot.handleUpdate(makeStart(555));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/bot/start.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/server/bot/handlers/start.ts`**

```ts
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { bootstrapAdminIfNeeded } from '@/server/domain/bootstrap';
import { consumeInvite, findOpenInviteByToken } from '@/server/domain/invites';
import { createUser, getUserByTelegramId } from '@/server/domain/users';

export interface StartOptions {
  bootstrapAdminTelegramId: number;
}

export function registerStartHandler(bot: Bot<BotContext>, opts: StartOptions) {
  bot.command('start', async (ctx) => {
    const tgFrom = ctx.from;
    if (!tgFrom) return;

    // existing user → welcome back
    if (ctx.currentUser) {
      await ctx.reply(`Welcome back, ${ctx.currentUser.displayName}. /menu to see options.`);
      return;
    }

    const payload = ctx.match?.trim();
    const inviteToken =
      typeof payload === 'string' && payload.startsWith('invite_')
        ? payload.slice('invite_'.length)
        : undefined;

    // invite path
    if (inviteToken) {
      const invite = await findOpenInviteByToken(ctx.db, inviteToken);
      if (!invite) {
        await ctx.reply('That invite is invalid or has already been used.');
        return;
      }
      const newUser = await createUser(ctx.db, {
        telegramUserId: tgFrom.id,
        telegramUsername: tgFrom.username ?? null,
        displayName:
          invite.displayNameHint ??
          [tgFrom.first_name, tgFrom.last_name].filter(Boolean).join(' ') ||
          tgFrom.username ||
          `User ${tgFrom.id}`,
        role: 'member',
      });
      await consumeInvite(ctx.db, inviteToken, newUser.id);
      await ctx.reply(`Welcome to the team, ${newUser.displayName}! /menu to see options.`);
      return;
    }

    // bootstrap admin path
    if (tgFrom.id === opts.bootstrapAdminTelegramId) {
      const result = await bootstrapAdminIfNeeded(ctx.db, {
        telegramUserId: tgFrom.id,
        telegramUsername: tgFrom.username ?? null,
        displayName:
          [tgFrom.first_name, tgFrom.last_name].filter(Boolean).join(' ') ||
          tgFrom.username ||
          'Admin',
      });
      if (result.created) {
        await ctx.reply('Welcome, admin. The team budget is yours. /menu to see options.');
        return;
      }
      // fall through to "not a member"
    }

    await ctx.reply(
      'You are not a team member yet. Ask your admin for an invite link.',
    );
  });
}
```

- [ ] **Step 4: Wire into `src/server/bot/index.ts`**

Replace the bottom of `getBot()` with:
```ts
import { registerStartHandler } from './handlers/start';
// ...
    _bot.use(identifyUser);
    registerStartHandler(_bot, {
      bootstrapAdminTelegramId: env().BOOTSTRAP_ADMIN_TELEGRAM_ID,
    });
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/bot/start.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "bot: /start with invite consumption and bootstrap admin"
```

---

### Task D4: /help and /menu stubs

**Files:**
- Create: `src/server/bot/handlers/help.ts`
- Create: `src/server/bot/handlers/menu.ts`
- Modify: `src/server/bot/index.ts`

- [ ] **Step 1: Write `src/server/bot/handlers/help.ts`**

```ts
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';

const HELP_TEXT = `Commands:
/balance — your outstanding debts
/history — your last 10 charges and payments
/info — team info / FAQ
/menu — main menu

Admin commands (admin only):
/admin — admin menu
/spend — record a spending
/pay — record a payment
/charge — create a charge
/invite — create an invite link
/info_edit — manage FAQ entries`;

export function registerHelpHandler(bot: Bot<BotContext>) {
  bot.command('help', async (ctx) => {
    await ctx.reply(HELP_TEXT);
  });
}
```

- [ ] **Step 2: Write `src/server/bot/handlers/menu.ts`**

```ts
import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';

export function registerMenuHandler(bot: Bot<BotContext>) {
  bot.command('menu', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
      return;
    }
    const kb = new InlineKeyboard()
      .text('💰 Balance', 'menu:balance')
      .text('📜 History', 'menu:history')
      .row()
      .text('ℹ️ Info', 'menu:info');
    if (ctx.currentUser.role === 'admin') {
      kb.row().text('🔧 Admin menu', 'menu:admin');
    }
    await ctx.reply(`Main menu — ${ctx.currentUser.displayName}`, {
      reply_markup: kb,
    });
  });

  // Stub callbacks for now; real handlers come in Plan 3.
  bot.callbackQuery(/^menu:/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Coming soon.' });
  });
}
```

- [ ] **Step 3: Wire into `src/server/bot/index.ts`**

Add after `registerStartHandler(...)`:
```ts
import { registerHelpHandler } from './handlers/help';
import { registerMenuHandler } from './handlers/menu';
// ...
    registerHelpHandler(_bot);
    registerMenuHandler(_bot);
```

- [ ] **Step 4: Write a smoke test**

`tests/bot/help-menu.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerHelpHandler } from '@/server/bot/handlers/help';
import { registerMenuHandler } from '@/server/bot/handlers/menu';

function setup(db: TestDb) {
  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc');
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({
        ok: true,
        result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' },
      } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => {
    ctx.db = db;
    return next();
  });
  bot.use(identifyUser);
  registerHelpHandler(bot);
  registerMenuHandler(bot);
  return { bot, replies };
}

function helpUpdate(fromId: number, cmd: string) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: `/${cmd}`,
      entities: [{ type: 'bot_command' as const, offset: 0, length: cmd.length + 1 }],
    },
  };
}

describe('/help and /menu', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('shows help text to anyone', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(helpUpdate(999, 'help'));
    expect(replies.join('\n')).toMatch(/balance.*history.*info/is);
  });

  it('rejects /menu for unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(helpUpdate(999, 'menu'));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows menu for member', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(helpUpdate(5, 'menu'));
    expect(replies.join('\n')).toMatch(/Main menu/i);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/bot/help-menu.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "bot: /help and /menu stubs"
```

---

### Task D5: Wire bot startup into boot.ts

**Files:**
- Modify: `src/server/boot.ts`

- [ ] **Step 1: Update boot to start the bot**

```ts
import 'server-only';
import { env } from './env';
import { startBot } from './bot';

type BootState = 'pending' | 'booting' | 'ready' | 'failed';

let state: BootState = 'pending';
let bootPromise: Promise<void> | null = null;

async function doBoot() {
  state = 'booting';
  try {
    env();
    if (process.env.SKIP_BOT !== '1') {
      // Don't await: long-polling starts a loop. We just want it to begin.
      void startBot().catch((err) => {
        console.error('Bot failed:', err);
      });
    }
    state = 'ready';
  } catch (err) {
    state = 'failed';
    throw err;
  }
}

export function getBootState(): BootState {
  return state;
}

export function bootOnce(): Promise<void> {
  if (!bootPromise) bootPromise = doBoot();
  return bootPromise;
}
```

- [ ] **Step 2: Update boot test to skip bot**

In `tests/boot.test.ts`, in `beforeEach` add: `process.env.SKIP_BOT = '1';`

- [ ] **Step 3: Trigger boot from the app**

`src/app/page.tsx`:
```tsx
import { bootOnce } from '@/server/boot';

export default async function HomePage() {
  await bootOnce();
  return <main style={{ padding: 24 }}>Team Budget — ready</main>;
}
```

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm test && pnpm typecheck
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "boot: start bot on app boot"
```

---

## Phase E — Money Domain Core

### Task E1: Money helpers

**Files:**
- Create: `src/server/domain/money.ts`
- Create: `tests/domain/money.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/money.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseAmount, formatAmount } from '@/server/domain/money';

describe('money', () => {
  it('parses dollars to cents', () => {
    expect(parseAmount('1.23')).toBe(123);
    expect(parseAmount('100')).toBe(10000);
    expect(parseAmount('0.50')).toBe(50);
  });

  it('rejects negatives by default', () => {
    expect(() => parseAmount('-1')).toThrow();
  });

  it('rejects too many decimal places', () => {
    expect(() => parseAmount('1.234')).toThrow();
  });

  it('formats cents to a display string', () => {
    expect(formatAmount(123, 'USD')).toBe('$1.23');
    expect(formatAmount(10000, 'USD')).toBe('$100.00');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/money.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/server/domain/money.ts`:
```ts
export type Cents = number;

export function parseAmount(input: string | number): Cents {
  const str = typeof input === 'number' ? String(input) : input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    throw new Error(`invalid amount: ${input}`);
  }
  const [whole, frac = ''] = str.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isFinite(cents) || cents < 0) throw new Error(`invalid amount: ${input}`);
  return cents;
}

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

export function formatAmount(cents: Cents, currency: string): string {
  const sym = SYMBOL[currency] ?? `${currency} `;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${sym}${dollars}.${remainder.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: money parse/format helpers"
```

---

### Task E2: Charge status computation

**Files:**
- Create: `src/server/domain/charge-status.ts`
- Create: `tests/domain/charge-status.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/charge-status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { statusForCharge } from '@/server/domain/charge-status';

describe('statusForCharge', () => {
  it('is open when nothing allocated', () => {
    expect(statusForCharge({ amount: 100, allocated: 0, cancelled: false })).toBe('open');
  });

  it('is open when partial', () => {
    expect(statusForCharge({ amount: 100, allocated: 40, cancelled: false })).toBe('open');
  });

  it('is paid when fully allocated', () => {
    expect(statusForCharge({ amount: 100, allocated: 100, cancelled: false })).toBe('paid');
  });

  it('stays paid even if overallocated (defensive)', () => {
    expect(statusForCharge({ amount: 100, allocated: 150, cancelled: false })).toBe('paid');
  });

  it('returns cancelled when cancelled flag set', () => {
    expect(statusForCharge({ amount: 100, allocated: 50, cancelled: true })).toBe('cancelled');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/charge-status.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/server/domain/charge-status.ts`:
```ts
export type ChargeStatus = 'open' | 'paid' | 'cancelled';

export interface StatusInput {
  amount: number;
  allocated: number;
  cancelled: boolean;
}

export function statusForCharge(input: StatusInput): ChargeStatus {
  if (input.cancelled) return 'cancelled';
  return input.allocated >= input.amount ? 'paid' : 'open';
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/charge-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: charge status calculator"
```

---

### Task E3: createAdhocCharge

**Files:**
- Create: `src/server/domain/charges.ts`
- Create: `tests/domain/charges-adhoc.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/charges-adhoc.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, getChargeById } from '@/server/domain/charges';

describe('createAdhocCharge', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    const a = await createUser(db, {
      telegramUserId: 1,
      displayName: 'Admin',
      role: 'admin',
    });
    adminId = a.id;
    const m = await createUser(db, {
      telegramUserId: 2,
      displayName: 'Vasya',
      role: 'member',
    });
    memberId = m.id;
  });

  it('creates a charge with amount in cents', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'Owed for gear rental',
      createdByUserId: adminId,
    });
    expect(c.type).toBe('adhoc');
    expect(c.amount).toBe(5000);
    expect(c.status).toBe('open');
  });

  it('rejects amount <= 0', async () => {
    await expect(
      createAdhocCharge(db, {
        userId: memberId,
        amount: 0,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown user', async () => {
    await expect(
      createAdhocCharge(db, {
        userId: 'nonexistent',
        amount: 100,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('roundtrips via getChargeById', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'Owed for gear rental',
      createdByUserId: adminId,
    });
    const fetched = await getChargeById(db, c.id);
    expect(fetched?.amount).toBe(5000);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/charges-adhoc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/server/domain/charges.ts`:
```ts
import { and, eq, isNull, sql, sum } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { charges, payments, paymentAllocations, users } from '@/server/db/schema';
import type { Db } from './types';
import { statusForCharge } from './charge-status';

export type Charge = typeof charges.$inferSelect;

async function assertUserExists(db: Db, userId: string) {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) throw new Error(`user ${userId} not found`);
}

export async function getChargeById(db: Db, id: string) {
  return db.select().from(charges).where(eq(charges.id, id)).get();
}

function assertPositive(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`amount must be a positive integer, got ${amount}`);
  }
}

export interface CreateAdhocChargeInput {
  userId: string;
  amount: number;
  description: string;
  createdByUserId: string;
}

export async function createAdhocCharge(db: Db, input: CreateAdhocChargeInput): Promise<Charge> {
  assertPositive(input.amount);
  await assertUserExists(db, input.userId);
  await assertUserExists(db, input.createdByUserId);
  const id = randomUUID();
  db.insert(charges)
    .values({
      id,
      userId: input.userId,
      type: 'adhoc',
      amount: input.amount,
      description: input.description,
      status: 'open',
      createdByUserId: input.createdByUserId,
    })
    .run();
  return (await getChargeById(db, id))!;
}

export async function sumAllocationsForCharge(db: Db, chargeId: string): Promise<number> {
  const row = db
    .select({ s: sum(paymentAllocations.amount) })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(and(eq(paymentAllocations.chargeId, chargeId), isNull(payments.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}

export async function recomputeChargeStatus(db: Db, chargeId: string) {
  const charge = await getChargeById(db, chargeId);
  if (!charge) throw new Error('charge missing');
  if (charge.status === 'cancelled') return;
  const allocated = await sumAllocationsForCharge(db, chargeId);
  const next = statusForCharge({
    amount: charge.amount,
    allocated,
    cancelled: false,
  });
  if (next !== charge.status) {
    db.update(charges).set({ status: next }).where(eq(charges.id, chargeId)).run();
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/charges-adhoc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: createAdhocCharge + status recompute helper"
```

---

### Task E4: createPotBorrow

**Files:**
- Modify: `src/server/domain/charges.ts`
- Create: `tests/domain/charges-pot-borrow.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/charges-pot-borrow.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createPotBorrow } from '@/server/domain/charges';

describe('createPotBorrow', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberId = (
      await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })
    ).id;
  });

  it('creates a pot_borrow charge with source_pot=cash', async () => {
    const c = await createPotBorrow(db, {
      userId: memberId,
      amount: 5000,
      sourcePot: 'cash',
      description: 'Borrowed for gas',
      createdByUserId: adminId,
    });
    expect(c.type).toBe('pot_borrow');
    expect(c.sourcePot).toBe('cash');
    expect(c.amount).toBe(5000);
  });

  it('rejects unknown source pot', async () => {
    await expect(
      createPotBorrow(db, {
        userId: memberId,
        amount: 100,
        // @ts-expect-error testing runtime guard
        sourcePot: 'crypto',
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects amount <= 0', async () => {
    await expect(
      createPotBorrow(db, {
        userId: memberId,
        amount: 0,
        sourcePot: 'card',
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/charges-pot-borrow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add to `src/server/domain/charges.ts`**

Append:
```ts
export type Pot = 'cash' | 'card';

export interface CreatePotBorrowInput {
  userId: string;
  amount: number;
  sourcePot: Pot;
  description: string;
  createdByUserId: string;
}

export async function createPotBorrow(db: Db, input: CreatePotBorrowInput): Promise<Charge> {
  assertPositive(input.amount);
  if (input.sourcePot !== 'cash' && input.sourcePot !== 'card') {
    throw new Error(`invalid source pot: ${String(input.sourcePot)}`);
  }
  await assertUserExists(db, input.userId);
  await assertUserExists(db, input.createdByUserId);
  const id = randomUUID();
  db.insert(charges)
    .values({
      id,
      userId: input.userId,
      type: 'pot_borrow',
      amount: input.amount,
      description: input.description,
      sourcePot: input.sourcePot,
      status: 'open',
      createdByUserId: input.createdByUserId,
    })
    .run();
  return (await getChargeById(db, id))!;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/charges-pot-borrow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: createPotBorrow"
```

---

### Task E5: recordPayment with allocation invariants

**Files:**
- Create: `src/server/domain/payments.ts`
- Create: `tests/domain/payments.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/payments.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, getChargeById } from '@/server/domain/charges';
import { recordPayment, listPaymentsByPayer } from '@/server/domain/payments';

describe('recordPayment', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberId = (
      await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })
    ).id;
  });

  it('records a fully-allocated payment against one charge', async () => {
    const charge = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'gear',
      createdByUserId: adminId,
    });
    const p = await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      allocations: [{ chargeId: charge.id, amount: 5000 }],
      createdByUserId: adminId,
    });
    expect(p.payment.method).toBe('cash');
    expect(p.allocations.length).toBe(1);
    expect((await getChargeById(db, charge.id))?.status).toBe('paid');
  });

  it('allocates across multiple charges', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 3000,
      description: 'a',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 7000,
      description: 'b',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'card',
      amount: 10000,
      allocations: [
        { chargeId: c1.id, amount: 3000 },
        { chargeId: c2.id, amount: 7000 },
      ],
      createdByUserId: adminId,
    });
    expect((await getChargeById(db, c1.id))?.status).toBe('paid');
    expect((await getChargeById(db, c2.id))?.status).toBe('paid');
  });

  it('rejects payment that does not fully allocate', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await expect(
      recordPayment(db, {
        payerUserId: memberId,
        method: 'cash',
        amount: 5000,
        allocations: [{ chargeId: c.id, amount: 4000 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/fully allocate/i);
  });

  it('rejects overallocating a single charge', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await expect(
      recordPayment(db, {
        payerUserId: memberId,
        method: 'cash',
        amount: 6000,
        allocations: [{ chargeId: c.id, amount: 6000 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/exceeds charge/i);
  });

  it('rejects allocation to another member’s charge', async () => {
    const other = await createUser(db, {
      telegramUserId: 3,
      displayName: 'O',
      role: 'member',
    });
    const c = await createAdhocCharge(db, {
      userId: other.id,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await expect(
      recordPayment(db, {
        payerUserId: memberId,
        method: 'cash',
        amount: 5000,
        allocations: [{ chargeId: c.id, amount: 5000 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow(/different member/i);
  });

  it('lists payments for payer', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      allocations: [{ chargeId: c.id, amount: 5000 }],
      createdByUserId: adminId,
    });
    const list = await listPaymentsByPayer(db, memberId);
    expect(list.length).toBe(1);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/payments.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/domain/payments.ts`**

```ts
import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { charges, payments, paymentAllocations, users } from '@/server/db/schema';
import type { Db } from './types';
import { recomputeChargeStatus, sumAllocationsForCharge } from './charges';

export type Pot = 'cash' | 'card';

export interface AllocationInput {
  chargeId: string;
  amount: number;
}

export interface RecordPaymentInput {
  payerUserId: string;
  method: Pot;
  amount: number;
  note?: string;
  receivedAt?: string;
  allocations: AllocationInput[];
  createdByUserId: string;
}

export interface RecordPaymentResult {
  payment: typeof payments.$inferSelect;
  allocations: (typeof paymentAllocations.$inferSelect)[];
}

function assertPositive(n: number, label: string) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a positive integer, got ${n}`);
  }
}

export async function recordPayment(
  db: Db,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  assertPositive(input.amount, 'payment amount');
  if (input.method !== 'cash' && input.method !== 'card') {
    throw new Error(`invalid method: ${String(input.method)}`);
  }
  if (input.allocations.length === 0) {
    throw new Error('payment must fully allocate to at least one charge');
  }
  const sumAlloc = input.allocations.reduce((s, a) => s + a.amount, 0);
  if (sumAlloc !== input.amount) {
    throw new Error(
      `payment must fully allocate: sum(allocations)=${sumAlloc} != amount=${input.amount}`,
    );
  }
  for (const a of input.allocations) assertPositive(a.amount, 'allocation amount');

  const payer = db.select().from(users).where(eq(users.id, input.payerUserId)).get();
  if (!payer) throw new Error(`payer ${input.payerUserId} not found`);

  // Validate each charge belongs to payer, isn't cancelled, and has headroom
  for (const a of input.allocations) {
    const c = db.select().from(charges).where(eq(charges.id, a.chargeId)).get();
    if (!c) throw new Error(`charge ${a.chargeId} not found`);
    if (c.userId !== input.payerUserId) {
      throw new Error(`charge ${a.chargeId} belongs to a different member`);
    }
    if (c.status === 'cancelled') {
      throw new Error(`charge ${a.chargeId} is cancelled`);
    }
    const alreadyAllocated = await sumAllocationsForCharge(db, a.chargeId);
    if (alreadyAllocated + a.amount > c.amount) {
      throw new Error(
        `allocation ${a.amount} on charge ${a.chargeId} exceeds charge (already ${alreadyAllocated}/${c.amount})`,
      );
    }
  }

  const paymentId = randomUUID();
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(payments)
      .values({
        id: paymentId,
        payerUserId: input.payerUserId,
        method: input.method,
        amount: input.amount,
        note: input.note ?? null,
        receivedAt,
        createdByUserId: input.createdByUserId,
      })
      .run();
    for (const a of input.allocations) {
      tx.insert(paymentAllocations)
        .values({
          id: randomUUID(),
          paymentId,
          chargeId: a.chargeId,
          amount: a.amount,
        })
        .run();
    }
  });

  for (const a of input.allocations) {
    await recomputeChargeStatus(db, a.chargeId);
  }

  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get()!;
  const allocs = db
    .select()
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .all();
  return { payment, allocations: allocs };
}

export async function listPaymentsByPayer(db: Db, payerUserId: string) {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.payerUserId, payerUserId), isNull(payments.cancelledAt)))
    .all();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/payments.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: recordPayment with allocation invariants"
```

---

### Task E6: cancelCharge and cancelPayment

**Files:**
- Modify: `src/server/domain/charges.ts`, `src/server/domain/payments.ts`
- Create: `tests/domain/cancellations.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/cancellations.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, getChargeById, cancelCharge } from '@/server/domain/charges';
import { recordPayment, cancelPayment } from '@/server/domain/payments';

describe('cancellations', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberId = (
      await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })
    ).id;
  });

  it('cancels a charge with no allocations', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    await cancelCharge(db, c.id);
    expect((await getChargeById(db, c.id))?.status).toBe('cancelled');
  });

  it('refuses to cancel a charge with allocations', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await expect(cancelCharge(db, c.id)).rejects.toThrow(/has allocations/i);
  });

  it('cancelling a payment reopens previously-paid charge', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    const { payment } = await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    expect((await getChargeById(db, c.id))?.status).toBe('paid');
    await cancelPayment(db, payment.id);
    expect((await getChargeById(db, c.id))?.status).toBe('open');
  });

  it('cancelling an already-cancelled payment is a no-op', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    const { payment } = await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await cancelPayment(db, payment.id);
    await cancelPayment(db, payment.id); // does not throw
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/cancellations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `cancelCharge` to `src/server/domain/charges.ts`**

Append:
```ts
export async function cancelCharge(db: Db, chargeId: string): Promise<Charge> {
  const c = await getChargeById(db, chargeId);
  if (!c) throw new Error(`charge ${chargeId} not found`);
  if (c.status === 'cancelled') return c;
  const allocated = await sumAllocationsForCharge(db, chargeId);
  if (allocated > 0) {
    throw new Error(
      `cannot cancel charge ${chargeId}: it has allocations (cancel the payments first)`,
    );
  }
  db.update(charges).set({ status: 'cancelled' }).where(eq(charges.id, chargeId)).run();
  return (await getChargeById(db, chargeId))!;
}
```

- [ ] **Step 4: Add `cancelPayment` to `src/server/domain/payments.ts`**

Append:
```ts
export async function cancelPayment(db: Db, paymentId: string) {
  const p = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!p) throw new Error(`payment ${paymentId} not found`);
  if (p.cancelledAt) return p; // idempotent

  const affectedCharges = db
    .select({ chargeId: paymentAllocations.chargeId })
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .all();

  db.update(payments)
    .set({ cancelledAt: new Date().toISOString() })
    .where(eq(payments.id, paymentId))
    .run();

  for (const { chargeId } of affectedCharges) {
    await recomputeChargeStatus(db, chargeId);
  }
  return db.select().from(payments).where(eq(payments.id, paymentId)).get()!;
}
```

Note: `sumAllocationsForCharge` already filters by `isNull(payments.cancelledAt)`, so after the payment is marked cancelled, its allocations are excluded from the sum on the next recompute — which correctly reopens the charge.

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/domain/cancellations.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "domain: cancelCharge and cancelPayment with cascade"
```

---

### Task E7: getMemberOutstandingDebt

**Files:**
- Modify: `src/server/domain/charges.ts`
- Create: `tests/domain/member-debt.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/member-debt.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createAdhocCharge,
  getMemberOutstandingDebt,
  listOpenChargesForMember,
} from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';

describe('outstanding debt', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberId = (
      await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })
    ).id;
  });

  it('is 0 with no charges', async () => {
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(0);
  });

  it('sums open charges', async () => {
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 3000,
      description: 'b',
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(8000);
  });

  it('subtracts allocations', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 3000,
      description: 'b',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 5000,
      allocations: [
        { chargeId: c.id, amount: 2000 },
        { chargeId: c2.id, amount: 3000 },
      ],
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(3000);
  });

  it('excludes cancelled charges', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 5000,
      description: 'a',
      createdByUserId: adminId,
    });
    const { cancelCharge } = await import('@/server/domain/charges');
    await cancelCharge(db, c.id);
    expect(await getMemberOutstandingDebt(db, memberId)).toBe(0);
  });

  it('lists open charges in FIFO order', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 1000,
      description: 'oldest',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 2000,
      description: 'newer',
      createdByUserId: adminId,
    });
    const list = await listOpenChargesForMember(db, memberId);
    expect(list.map((c) => c.id)).toEqual([c1.id, c2.id]);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/member-debt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add to `src/server/domain/charges.ts`**

Add `asc` to the existing drizzle-orm import at the top of the file (`import { and, asc, eq, isNull, sql, sum } from 'drizzle-orm';`), then append:

```ts
export async function listOpenChargesForMember(db: Db, userId: string) {
  return db
    .select()
    .from(charges)
    .where(and(eq(charges.userId, userId), eq(charges.status, 'open')))
    .orderBy(asc(charges.createdAt))
    .all();
}

export async function getMemberOutstandingDebt(db: Db, userId: string): Promise<number> {
  const open = await listOpenChargesForMember(db, userId);
  let total = 0;
  for (const c of open) {
    const allocated = await sumAllocationsForCharge(db, c.id);
    total += c.amount - allocated;
  }
  return total;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/member-debt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: getMemberOutstandingDebt and listOpenChargesForMember"
```

---

### Task E8: FIFO allocation helper

**Files:**
- Modify: `src/server/domain/payments.ts`
- Create: `tests/domain/fifo-allocate.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/fifo-allocate.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { fifoAllocate } from '@/server/domain/payments';

describe('fifoAllocate', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberId = (
      await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })
    ).id;
  });

  it('allocates fully to one charge', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    expect(await fifoAllocate(db, memberId, 100)).toEqual([
      { chargeId: c.id, amount: 100 },
    ]);
  });

  it('splits across oldest first', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'oldest',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'newer',
      createdByUserId: adminId,
    });
    expect(await fifoAllocate(db, memberId, 150)).toEqual([
      { chargeId: c1.id, amount: 100 },
      { chargeId: c2.id, amount: 50 },
    ]);
  });

  it('throws when amount exceeds total debt', async () => {
    await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    await expect(fifoAllocate(db, memberId, 150)).rejects.toThrow(/exceeds/i);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/fifo-allocate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `fifoAllocate` to `src/server/domain/payments.ts`**

```ts
import {
  listOpenChargesForMember,
  sumAllocationsForCharge,
} from './charges';

export async function fifoAllocate(
  db: Db,
  payerUserId: string,
  amount: number,
): Promise<AllocationInput[]> {
  let remaining = amount;
  const result: AllocationInput[] = [];
  const open = await listOpenChargesForMember(db, payerUserId);
  for (const c of open) {
    if (remaining <= 0) break;
    const already = await sumAllocationsForCharge(db, c.id);
    const headroom = c.amount - already;
    if (headroom <= 0) continue;
    const take = Math.min(headroom, remaining);
    result.push({ chargeId: c.id, amount: take });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error(
      `payment amount ${amount} exceeds total open debt by ${remaining}`,
    );
  }
  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/fifo-allocate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: fifoAllocate helper for default payment allocation"
```

---

## Phase F — Pots & Spendings

### Task F1: recordSpending and cancelSpending

**Files:**
- Create: `src/server/domain/spendings.ts`
- Create: `tests/domain/spendings.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/spendings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { recordSpending, cancelSpending } from '@/server/domain/spendings';

describe('spendings', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
  });

  it('records a spending against a pot', async () => {
    const s = await recordSpending(db, {
      pot: 'cash',
      amount: 800,
      description: 'ammo',
      createdByUserId: adminId,
    });
    expect(s.amount).toBe(800);
    expect(s.pot).toBe('cash');
  });

  it('rejects invalid pot', async () => {
    await expect(
      recordSpending(db, {
        // @ts-expect-error runtime
        pot: 'crypto',
        amount: 100,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects amount <= 0', async () => {
    await expect(
      recordSpending(db, {
        pot: 'cash',
        amount: 0,
        description: 'x',
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('cancelSpending sets cancelledAt', async () => {
    const s = await recordSpending(db, {
      pot: 'cash',
      amount: 800,
      description: 'ammo',
      createdByUserId: adminId,
    });
    const cancelled = await cancelSpending(db, s.id);
    expect(cancelled.cancelledAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/spendings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/domain/spendings.ts`**

```ts
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { spendings, users, categories } from '@/server/db/schema';
import type { Db } from './types';

export type Pot = 'cash' | 'card';

export interface RecordSpendingInput {
  pot: Pot;
  amount: number;
  categoryId?: string | null;
  description: string;
  occurredAt?: string;
  createdByUserId: string;
}

export async function recordSpending(db: Db, input: RecordSpendingInput) {
  if (input.pot !== 'cash' && input.pot !== 'card') {
    throw new Error(`invalid pot: ${String(input.pot)}`);
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error(`spending amount must be a positive integer, got ${input.amount}`);
  }
  if (!db.select().from(users).where(eq(users.id, input.createdByUserId)).get()) {
    throw new Error('creator not found');
  }
  if (input.categoryId) {
    if (!db.select().from(categories).where(eq(categories.id, input.categoryId)).get()) {
      throw new Error('category not found');
    }
  }
  const id = randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  db.insert(spendings)
    .values({
      id,
      pot: input.pot,
      amount: input.amount,
      categoryId: input.categoryId ?? null,
      description: input.description,
      occurredAt,
      createdByUserId: input.createdByUserId,
    })
    .run();
  return db.select().from(spendings).where(eq(spendings.id, id)).get()!;
}

export async function cancelSpending(db: Db, id: string) {
  const s = db.select().from(spendings).where(eq(spendings.id, id)).get();
  if (!s) throw new Error('spending not found');
  if (s.cancelledAt) return s;
  db.update(spendings)
    .set({ cancelledAt: new Date().toISOString() })
    .where(eq(spendings.id, id))
    .run();
  return db.select().from(spendings).where(eq(spendings.id, id)).get()!;
}

export async function listSpendings(db: Db) {
  return db.select().from(spendings).all();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/spendings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: spendings (record, cancel, list)"
```

---

### Task F2: Pot balance calculation

**Files:**
- Create: `src/server/domain/pots.ts`
- Create: `tests/domain/pots.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/pots.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge, createPotBorrow } from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { getPotBalances } from '@/server/domain/pots';

describe('pots', () => {
  let db: TestDb;
  let adminId: string;
  let memberId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberId = (
      await createUser(db, { telegramUserId: 2, displayName: 'V', role: 'member' })
    ).id;
  });

  it('is zero for empty db', async () => {
    expect(await getPotBalances(db)).toEqual({ cash: 0, card: 0 });
  });

  it('counts payments by method', async () => {
    const c1 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    const c2 = await createAdhocCharge(db, {
      userId: memberId,
      amount: 300,
      description: 'b',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c1.id, amount: 100 }],
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'card',
      amount: 300,
      allocations: [{ chargeId: c2.id, amount: 300 }],
      createdByUserId: adminId,
    });
    expect(await getPotBalances(db)).toEqual({ cash: 100, card: 300 });
  });

  it('subtracts spendings by pot', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 500,
      description: 'a',
      createdByUserId: adminId,
    });
    await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 500,
      allocations: [{ chargeId: c.id, amount: 500 }],
      createdByUserId: adminId,
    });
    await recordSpending(db, {
      pot: 'cash',
      amount: 200,
      description: 'ammo',
      createdByUserId: adminId,
    });
    expect(await getPotBalances(db)).toEqual({ cash: 300, card: 0 });
  });

  it('subtracts pot_borrow from source pot regardless of paid status', async () => {
    await createPotBorrow(db, {
      userId: memberId,
      amount: 50,
      sourcePot: 'cash',
      description: 'gas',
      createdByUserId: adminId,
    });
    expect(await getPotBalances(db)).toEqual({ cash: -50, card: 0 });
  });

  it('ignores cancelled payments and cancelled spendings', async () => {
    const c = await createAdhocCharge(db, {
      userId: memberId,
      amount: 100,
      description: 'a',
      createdByUserId: adminId,
    });
    const { payment } = await recordPayment(db, {
      payerUserId: memberId,
      method: 'cash',
      amount: 100,
      allocations: [{ chargeId: c.id, amount: 100 }],
      createdByUserId: adminId,
    });
    const s = await recordSpending(db, {
      pot: 'cash',
      amount: 30,
      description: 'x',
      createdByUserId: adminId,
    });
    const { cancelPayment } = await import('@/server/domain/payments');
    const { cancelSpending } = await import('@/server/domain/spendings');
    await cancelPayment(db, payment.id);
    await cancelSpending(db, s.id);
    expect(await getPotBalances(db)).toEqual({ cash: 0, card: 0 });
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/pots.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/domain/pots.ts`**

```ts
import { and, eq, isNull, sum } from 'drizzle-orm';
import { charges, payments, spendings } from '@/server/db/schema';
import type { Db } from './types';

export interface PotBalances {
  cash: number;
  card: number;
}

async function sumPaymentsByMethod(db: Db, method: 'cash' | 'card'): Promise<number> {
  const row = db
    .select({ s: sum(payments.amount) })
    .from(payments)
    .where(and(eq(payments.method, method), isNull(payments.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}

async function sumSpendingsByPot(db: Db, pot: 'cash' | 'card'): Promise<number> {
  const row = db
    .select({ s: sum(spendings.amount) })
    .from(spendings)
    .where(and(eq(spendings.pot, pot), isNull(spendings.cancelledAt)))
    .get();
  return Number(row?.s ?? 0);
}

async function sumPotBorrows(db: Db, pot: 'cash' | 'card'): Promise<number> {
  // pot_borrow rows that aren't cancelled (status != 'cancelled')
  const rows = db
    .select({ amount: charges.amount, status: charges.status })
    .from(charges)
    .where(and(eq(charges.type, 'pot_borrow'), eq(charges.sourcePot, pot)))
    .all();
  return rows.filter((r) => r.status !== 'cancelled').reduce((s, r) => s + r.amount, 0);
}

export async function getPotBalances(db: Db): Promise<PotBalances> {
  const [cashIn, cashOut, cashBorrow] = await Promise.all([
    sumPaymentsByMethod(db, 'cash'),
    sumSpendingsByPot(db, 'cash'),
    sumPotBorrows(db, 'cash'),
  ]);
  const [cardIn, cardOut, cardBorrow] = await Promise.all([
    sumPaymentsByMethod(db, 'card'),
    sumSpendingsByPot(db, 'card'),
    sumPotBorrows(db, 'card'),
  ]);
  return {
    cash: cashIn - cashOut - cashBorrow,
    card: cardIn - cardOut - cardBorrow,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/pots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: pot balance calculation"
```

---

## Phase G — Splits, Dues, Settings, Categories

### Task G1: Settings domain

**Files:**
- Create: `src/server/domain/settings.ts`
- Create: `tests/domain/settings.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/settings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import {
  getOrCreateSettings,
  updateMonthlyDuesAmount,
  setLastDuesGeneratedFor,
} from '@/server/domain/settings';

describe('settings', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates defaults on first read', async () => {
    const s = await getOrCreateSettings(db);
    expect(s.monthlyDuesAmount).toBe(0);
    expect(s.currency).toBe('USD');
    expect(s.dueDay).toBe(1);
    expect(s.lastDuesGeneratedFor).toBeNull();
  });

  it('updates monthly dues amount', async () => {
    await getOrCreateSettings(db);
    const updated = await updateMonthlyDuesAmount(db, 5000);
    expect(updated.monthlyDuesAmount).toBe(5000);
  });

  it('records last dues generated for', async () => {
    await getOrCreateSettings(db);
    const updated = await setLastDuesGeneratedFor(db, '2026-05');
    expect(updated.lastDuesGeneratedFor).toBe('2026-05');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/domain/settings.ts`**

```ts
import { eq } from 'drizzle-orm';
import { settings } from '@/server/db/schema';
import type { Db } from './types';

export async function getOrCreateSettings(db: Db) {
  let row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) {
    db.insert(settings)
      .values({ id: 1, monthlyDuesAmount: 0, currency: 'USD', dueDay: 1 })
      .run();
    row = db.select().from(settings).where(eq(settings.id, 1)).get();
  }
  return row!;
}

export async function updateMonthlyDuesAmount(db: Db, amount: number) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`amount must be a non-negative integer`);
  }
  await getOrCreateSettings(db);
  db.update(settings).set({ monthlyDuesAmount: amount }).where(eq(settings.id, 1)).run();
  return (await getOrCreateSettings(db))!;
}

export async function setLastDuesGeneratedFor(db: Db, period: string | null) {
  await getOrCreateSettings(db);
  db.update(settings)
    .set({ lastDuesGeneratedFor: period })
    .where(eq(settings.id, 1))
    .run();
  return (await getOrCreateSettings(db))!;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: settings"
```

---

### Task G2: Categories domain

**Files:**
- Create: `src/server/domain/categories.ts`
- Create: `tests/domain/categories.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/categories.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import {
  createCategory,
  listCategories,
  archiveCategory,
  renameCategory,
} from '@/server/domain/categories';

describe('categories', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a category', async () => {
    const c = await createCategory(db, 'Ammo');
    expect(c.name).toBe('Ammo');
    expect(c.archived).toBe(false);
  });

  it('lists active categories', async () => {
    await createCategory(db, 'Ammo');
    await createCategory(db, 'Range');
    expect((await listCategories(db)).map((c) => c.name)).toEqual(['Ammo', 'Range']);
  });

  it('archives a category', async () => {
    const c = await createCategory(db, 'Ammo');
    await archiveCategory(db, c.id);
    expect(await listCategories(db)).toEqual([]);
    expect((await listCategories(db, { includeArchived: true })).length).toBe(1);
  });

  it('renames a category', async () => {
    const c = await createCategory(db, 'Ammo');
    const r = await renameCategory(db, c.id, 'Ammunition');
    expect(r.name).toBe('Ammunition');
  });

  it('rejects empty name', async () => {
    await expect(createCategory(db, '')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/categories.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/domain/categories.ts`**

```ts
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { categories } from '@/server/db/schema';
import type { Db } from './types';

export async function createCategory(db: Db, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error('category name required');
  const id = randomUUID();
  db.insert(categories).values({ id, name: clean, archived: false }).run();
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}

export async function listCategories(db: Db, opts: { includeArchived?: boolean } = {}) {
  const rows = db.select().from(categories).orderBy(asc(categories.name)).all();
  return opts.includeArchived ? rows : rows.filter((c) => !c.archived);
}

export async function archiveCategory(db: Db, id: string) {
  db.update(categories).set({ archived: true }).where(eq(categories.id, id)).run();
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}

export async function renameCategory(db: Db, id: string, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error('category name required');
  db.update(categories).set({ name: clean }).where(eq(categories.id, id)).run();
  return db.select().from(categories).where(eq(categories.id, id)).get()!;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/categories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: categories"
```

---

### Task G3: createSplitCharge

**Files:**
- Modify: `src/server/domain/charges.ts`
- Create: `tests/domain/charges-split.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/charges-split.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createSplitCharge } from '@/server/domain/charges';

describe('createSplitCharge', () => {
  let db: TestDb;
  let adminId: string;
  let members: string[];
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    members = [];
    for (let i = 0; i < 3; i++) {
      members.push(
        (
          await createUser(db, {
            telegramUserId: 100 + i,
            displayName: `M${i}`,
            role: 'member',
          })
        ).id,
      );
    }
  });

  it('creates N charges sharing a group_id', async () => {
    const allocations = members.map((id) => ({ userId: id, amount: 8000 }));
    const result = await createSplitCharge(db, {
      description: 'Tactical backpacks',
      allocations,
      createdByUserId: adminId,
    });
    expect(result.charges.length).toBe(3);
    const groupIds = new Set(result.charges.map((c) => c.groupId));
    expect(groupIds.size).toBe(1);
    for (const c of result.charges) {
      expect(c.type).toBe('out_of_bounds');
      expect(c.amount).toBe(8000);
    }
  });

  it('supports unequal amounts', async () => {
    const result = await createSplitCharge(db, {
      description: 'Field rental',
      allocations: [
        { userId: members[0]!, amount: 5000 },
        { userId: members[1]!, amount: 3000 },
        { userId: members[2]!, amount: 2000 },
      ],
      createdByUserId: adminId,
    });
    expect(result.charges.map((c) => c.amount).sort((a, b) => a - b)).toEqual([
      2000, 3000, 5000,
    ]);
  });

  it('rejects empty allocations', async () => {
    await expect(
      createSplitCharge(db, {
        description: 'x',
        allocations: [],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown member', async () => {
    await expect(
      createSplitCharge(db, {
        description: 'x',
        allocations: [{ userId: 'ghost', amount: 100 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });

  it('rejects non-positive per-member amount', async () => {
    await expect(
      createSplitCharge(db, {
        description: 'x',
        allocations: [{ userId: members[0]!, amount: 0 }],
        createdByUserId: adminId,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/charges-split.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add to `src/server/domain/charges.ts`**

```ts
export interface SplitAllocation {
  userId: string;
  amount: number;
}

export interface CreateSplitChargeInput {
  description: string;
  allocations: SplitAllocation[];
  createdByUserId: string;
}

export interface SplitChargeResult {
  groupId: string;
  charges: Charge[];
}

export async function createSplitCharge(
  db: Db,
  input: CreateSplitChargeInput,
): Promise<SplitChargeResult> {
  if (input.allocations.length === 0) {
    throw new Error('split must include at least one allocation');
  }
  for (const a of input.allocations) {
    assertPositive(a.amount);
    await assertUserExists(db, a.userId);
  }
  await assertUserExists(db, input.createdByUserId);
  const groupId = randomUUID();
  const ids: string[] = [];
  db.transaction((tx) => {
    for (const a of input.allocations) {
      const id = randomUUID();
      ids.push(id);
      tx.insert(charges)
        .values({
          id,
          userId: a.userId,
          type: 'out_of_bounds',
          amount: a.amount,
          description: input.description,
          groupId,
          status: 'open',
          createdByUserId: input.createdByUserId,
        })
        .run();
    }
  });
  const out: Charge[] = [];
  for (const id of ids) {
    const c = await getChargeById(db, id);
    if (c) out.push(c);
  }
  return { groupId, charges: out };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/charges-split.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: createSplitCharge with shared group_id"
```

---

### Task G4: Monthly dues generation (idempotent)

**Files:**
- Create: `src/server/domain/dues.ts`
- Create: `tests/domain/dues.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/dues.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser, deactivateUser } from '@/server/domain/users';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';
import { generateMonthlyDues } from '@/server/domain/dues';
import { charges } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

describe('generateMonthlyDues', () => {
  let db: TestDb;
  let adminId: string;
  let memberIds: string[];

  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    memberIds = [];
    for (let i = 0; i < 3; i++) {
      memberIds.push(
        (
          await createUser(db, {
            telegramUserId: 100 + i,
            displayName: `M${i}`,
            role: 'member',
          })
        ).id,
      );
    }
    await updateMonthlyDuesAmount(db, 5000);
  });

  it('creates one charge per active user for the period', async () => {
    const r = await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    expect(r.createdCount).toBe(4); // admin + 3 members, all active
    const all = db
      .select()
      .from(charges)
      .where(eq(charges.billingPeriod, '2026-05'))
      .all();
    expect(all.length).toBe(4);
    for (const c of all) expect(c.amount).toBe(5000);
  });

  it('is idempotent — second call creates 0', async () => {
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    const r2 = await generateMonthlyDues(db, {
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(r2.createdCount).toBe(0);
  });

  it('skips inactive users', async () => {
    await deactivateUser(db, memberIds[0]!);
    const r = await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    expect(r.createdCount).toBe(3);
  });

  it('uses the current monthly_dues_amount at generation time', async () => {
    await updateMonthlyDuesAmount(db, 7000);
    await generateMonthlyDues(db, { period: '2026-06', createdByUserId: adminId });
    const all = db
      .select()
      .from(charges)
      .where(eq(charges.billingPeriod, '2026-06'))
      .all();
    for (const c of all) expect(c.amount).toBe(7000);
  });

  it('uses settings.last_dues_generated_for as the idempotency marker', async () => {
    await generateMonthlyDues(db, { period: '2026-05', createdByUserId: adminId });
    // simulate concurrent re-entry: even if we don't check existing charges,
    // the second call should short-circuit on the settings marker.
    const r2 = await generateMonthlyDues(db, {
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(r2.createdCount).toBe(0);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/dues.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/domain/dues.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { charges, users } from '@/server/db/schema';
import type { Db } from './types';
import { getOrCreateSettings, setLastDuesGeneratedFor } from './settings';

export interface GenerateDuesInput {
  period: string; // YYYY-MM
  createdByUserId: string;
}

export interface GenerateDuesResult {
  createdCount: number;
  period: string;
}

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

  // also guard: skip any users who already have a dues row for the period
  const existing = db
    .select({ userId: charges.userId })
    .from(charges)
    .where(and(eq(charges.type, 'monthly_dues'), eq(charges.billingPeriod, input.period)))
    .all();
  const have = new Set(existing.map((r) => r.userId));

  const active = db.select().from(users).where(eq(users.isActive, true)).all();

  let created = 0;
  db.transaction((tx) => {
    for (const u of active) {
      if (have.has(u.id)) continue;
      tx.insert(charges)
        .values({
          id: randomUUID(),
          userId: u.id,
          type: 'monthly_dues',
          amount: s.monthlyDuesAmount,
          description: `Monthly dues — ${input.period}`,
          billingPeriod: input.period,
          status: 'open',
          createdByUserId: input.createdByUserId,
        })
        .run();
      created += 1;
    }
  });

  await setLastDuesGeneratedFor(db, input.period);
  return { createdCount: created, period: input.period };
}

export function currentBillingPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/dues.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: idempotent monthly dues generation"
```

---

### Task G5: node-cron wiring in boot.ts

**Files:**
- Create: `src/server/jobs/monthly-dues.ts`
- Modify: `src/server/boot.ts`
- Create: `tests/jobs/monthly-dues.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/jobs/monthly-dues.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';
import { runMonthlyDuesOnce } from '@/server/jobs/monthly-dues';
import { charges } from '@/server/db/schema';

describe('runMonthlyDuesOnce', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
    await updateMonthlyDuesAmount(db, 5000);
  });

  it('uses currentBillingPeriod and createdBy=admin user', async () => {
    const result = await runMonthlyDuesOnce(db, { now: new Date('2026-05-15T00:00:00Z') });
    expect(result.period).toBe('2026-05');
    const rows = db.select().from(charges).all();
    expect(rows.length).toBe(1);
    expect(rows[0]?.createdByUserId).toBe(adminId);
  });

  it('throws if no admin exists', async () => {
    const db2 = createTestDb();
    await updateMonthlyDuesAmount(db2, 5000);
    await expect(
      runMonthlyDuesOnce(db2, { now: new Date('2026-05-15T00:00:00Z') }),
    ).rejects.toThrow(/no admin/i);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/jobs/monthly-dues.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/jobs/monthly-dues.ts`**

```ts
import { eq } from 'drizzle-orm';
import cron from 'node-cron';
import { users } from '@/server/db/schema';
import type { Db } from '@/server/domain/types';
import { currentBillingPeriod, generateMonthlyDues } from '@/server/domain/dues';

export interface RunOptions {
  now?: Date;
}

async function pickSystemAdmin(db: Db): Promise<string> {
  const admin = db.select().from(users).where(eq(users.role, 'admin')).get();
  if (!admin) throw new Error('no admin user available to attribute dues to');
  return admin.id;
}

export async function runMonthlyDuesOnce(db: Db, opts: RunOptions = {}) {
  const period = currentBillingPeriod(opts.now);
  const adminId = await pickSystemAdmin(db);
  return generateMonthlyDues(db, { period, createdByUserId: adminId });
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

- [ ] **Step 4: Wire into `src/server/boot.ts`**

```ts
import { startBot } from './bot';
import { scheduleMonthlyDues } from './jobs/monthly-dues';
import { getDb } from './db/client';

// ... inside doBoot(), after starting the bot:
    if (process.env.SKIP_CRON !== '1') {
      scheduleMonthlyDues(getDb);
    }
```

- [ ] **Step 5: Update boot test to skip cron**

In `tests/boot.test.ts` `beforeEach`, add: `process.env.SKIP_CRON = '1';`

- [ ] **Step 6: Run tests**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "jobs: schedule monthly dues via node-cron"
```

---

## Phase H — Info Pages

### Task H1: Info pages domain

**Files:**
- Create: `src/server/domain/info-pages.ts`
- Create: `tests/domain/info-pages.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/domain/info-pages.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  createInfoPage,
  updateInfoPage,
  listInfoPages,
  reorderInfoPages,
  deleteInfoPage,
} from '@/server/domain/info-pages';

describe('info pages', () => {
  let db: TestDb;
  let adminId: string;
  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' })
    ).id;
  });

  it('creates and lists in sortOrder', async () => {
    const a = await createInfoPage(db, {
      title: 'Card details',
      body: '...',
      updatedByUserId: adminId,
    });
    const b = await createInfoPage(db, {
      title: 'How to pay',
      body: '...',
      updatedByUserId: adminId,
    });
    const list = await listInfoPages(db);
    expect(list.map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('updates title and body', async () => {
    const p = await createInfoPage(db, {
      title: 'Old',
      body: 'x',
      updatedByUserId: adminId,
    });
    const updated = await updateInfoPage(db, p.id, {
      title: 'New',
      body: 'y',
      updatedByUserId: adminId,
    });
    expect(updated.title).toBe('New');
    expect(updated.body).toBe('y');
  });

  it('reorders pages', async () => {
    const a = await createInfoPage(db, {
      title: 'A',
      body: '',
      updatedByUserId: adminId,
    });
    const b = await createInfoPage(db, {
      title: 'B',
      body: '',
      updatedByUserId: adminId,
    });
    const c = await createInfoPage(db, {
      title: 'C',
      body: '',
      updatedByUserId: adminId,
    });
    await reorderInfoPages(db, [c.id, a.id, b.id]);
    const list = await listInfoPages(db);
    expect(list.map((p) => p.id)).toEqual([c.id, a.id, b.id]);
  });

  it('deletes a page', async () => {
    const p = await createInfoPage(db, {
      title: 'X',
      body: '',
      updatedByUserId: adminId,
    });
    await deleteInfoPage(db, p.id);
    expect((await listInfoPages(db)).length).toBe(0);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/domain/info-pages.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/domain/info-pages.ts`**

```ts
import { asc, eq, max } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { infoPages } from '@/server/db/schema';
import type { Db } from './types';

export interface CreateInfoPageInput {
  title: string;
  body: string;
  updatedByUserId: string;
}

export async function createInfoPage(db: Db, input: CreateInfoPageInput) {
  const title = input.title.trim();
  if (!title) throw new Error('title required');
  const id = randomUUID();
  const maxRow = db.select({ m: max(infoPages.sortOrder) }).from(infoPages).get();
  const nextOrder = (Number(maxRow?.m ?? -1)) + 1;
  const now = new Date().toISOString();
  db.insert(infoPages)
    .values({
      id,
      title,
      body: input.body,
      sortOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
      updatedByUserId: input.updatedByUserId,
    })
    .run();
  return db.select().from(infoPages).where(eq(infoPages.id, id)).get()!;
}

export async function updateInfoPage(
  db: Db,
  id: string,
  input: { title?: string; body?: string; updatedByUserId: string },
) {
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedByUserId: input.updatedByUserId,
  };
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new Error('title required');
    patch.title = t;
  }
  if (input.body !== undefined) patch.body = input.body;
  db.update(infoPages).set(patch).where(eq(infoPages.id, id)).run();
  return db.select().from(infoPages).where(eq(infoPages.id, id)).get()!;
}

export async function listInfoPages(db: Db) {
  return db.select().from(infoPages).orderBy(asc(infoPages.sortOrder)).all();
}

export async function reorderInfoPages(db: Db, orderedIds: string[]) {
  db.transaction((tx) => {
    orderedIds.forEach((id, idx) => {
      tx.update(infoPages).set({ sortOrder: idx }).where(eq(infoPages.id, id)).run();
    });
  });
}

export async function deleteInfoPage(db: Db, id: string) {
  db.delete(infoPages).where(eq(infoPages.id, id)).run();
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/domain/info-pages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "domain: info pages CRUD + reorder"
```

---

### Task H2: Bot Markdown V2 escape helper

**Files:**
- Create: `src/server/bot/markdown.ts`
- Create: `tests/bot/markdown.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/bot/markdown.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { escapeMarkdownV2 } from '@/server/bot/markdown';

describe('escapeMarkdownV2', () => {
  it('escapes all reserved characters', () => {
    expect(escapeMarkdownV2('a_b*c[d]')).toBe('a\\_b\\*c\\[d\\]');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeMarkdownV2('hello world')).toBe('hello world');
  });

  it('escapes parens and dot', () => {
    expect(escapeMarkdownV2('see (note.).')).toBe('see \\(note\\.\\)\\.');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/bot/markdown.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/bot/markdown.ts`**

```ts
const RESERVED = /[_*[\]()~`>#+\-=|{}.!\\]/g;

export function escapeMarkdownV2(input: string): string {
  return input.replace(RESERVED, (m) => `\\${m}`);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/bot/markdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "bot: markdown v2 escape helper"
```

---

## Phase I — End-to-End Verification & CI

### Task I1: End-to-end domain integration test

**Files:**
- Create: `tests/integration/money-flow.test.ts`

- [ ] **Step 1: Write the integration test**

`tests/integration/money-flow.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { updateMonthlyDuesAmount } from '@/server/domain/settings';
import { generateMonthlyDues } from '@/server/domain/dues';
import {
  createSplitCharge,
  createPotBorrow,
  getMemberOutstandingDebt,
} from '@/server/domain/charges';
import { recordPayment, fifoAllocate } from '@/server/domain/payments';
import { recordSpending } from '@/server/domain/spendings';
import { getPotBalances } from '@/server/domain/pots';

describe('money flow integration', () => {
  let db: TestDb;
  let adminId: string;
  let vasya: string;
  let petya: string;

  beforeEach(async () => {
    db = createTestDb();
    adminId = (
      await createUser(db, { telegramUserId: 1, displayName: 'Admin', role: 'admin' })
    ).id;
    vasya = (
      await createUser(db, {
        telegramUserId: 100,
        displayName: 'Vasya',
        role: 'member',
      })
    ).id;
    petya = (
      await createUser(db, {
        telegramUserId: 101,
        displayName: 'Petya',
        role: 'member',
      })
    ).id;
    await updateMonthlyDuesAmount(db, 5000); // $50
  });

  it('runs the canonical scenario end-to-end', async () => {
    // Step 1: Generate May dues (all 3 active users including admin)
    const r1 = await generateMonthlyDues(db, {
      period: '2026-05',
      createdByUserId: adminId,
    });
    expect(r1.createdCount).toBe(3);

    // Step 2: Admin creates an out-of-bounds split: $80 backpacks for vasya and petya
    await createSplitCharge(db, {
      description: 'Tactical backpacks',
      allocations: [
        { userId: vasya, amount: 8000 },
        { userId: petya, amount: 8000 },
      ],
      createdByUserId: adminId,
    });

    // Vasya now owes $50 + $80 = $130
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(13000);

    // Step 3: Vasya pays $50 cash, allocated FIFO (clears May dues)
    const alloc = await fifoAllocate(db, vasya, 5000);
    await recordPayment(db, {
      payerUserId: vasya,
      method: 'cash',
      amount: 5000,
      allocations: alloc,
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(8000);

    // Step 4: Admin spends $30 cash on ammo
    await recordSpending(db, {
      pot: 'cash',
      amount: 3000,
      description: 'Ammo',
      createdByUserId: adminId,
    });

    // Cash pot = $50 in - $30 out = $20
    let pots = await getPotBalances(db);
    expect(pots).toEqual({ cash: 2000, card: 0 });

    // Step 5: Vasya borrows $20 cash from the pot
    await createPotBorrow(db, {
      userId: vasya,
      amount: 2000,
      sourcePot: 'cash',
      description: 'Range fee front',
      createdByUserId: adminId,
    });
    pots = await getPotBalances(db);
    expect(pots).toEqual({ cash: 0, card: 0 });
    // Vasya now owes $80 backpacks + $20 borrow = $100
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(10000);

    // Step 6: Vasya repays the entire $100 via card
    const alloc2 = await fifoAllocate(db, vasya, 10000);
    await recordPayment(db, {
      payerUserId: vasya,
      method: 'card',
      amount: 10000,
      allocations: alloc2,
      createdByUserId: adminId,
    });
    expect(await getMemberOutstandingDebt(db, vasya)).toBe(0);

    // Cash pot still 0 (paid back via card); card pot now $100
    pots = await getPotBalances(db);
    expect(pots).toEqual({ cash: 0, card: 10000 });
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `pnpm test tests/integration/money-flow.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "tests: end-to-end money flow integration"
```

---

### Task I2: README + dev setup

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:
````md
# Team Budget

Self-hosted budget tracker for an airsoft team. Web UI + Telegram bot, single SQLite database.

## Status

Plan 1 (Foundation & Money Domain) — backend layer complete and tested. Web UI and bot conversational write flows arrive in Plan 2 and Plan 3.

## Dev setup

Requirements:
- Node 20 LTS
- pnpm 9+
- A Telegram bot from [@BotFather](https://t.me/BotFather)
- Your Telegram numeric ID (use [@userinfobot](https://t.me/userinfobot))

```bash
pnpm install
cp .env.example .env   # edit with your bot token and IDs
mkdir -p data
pnpm db:migrate
pnpm dev
```

Visit http://localhost:3000.

## Scripts

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Next.js dev server + bot polling + cron             |
| `pnpm build`       | Production build                                    |
| `pnpm start`       | Production server                                   |
| `pnpm test`        | Vitest one-shot                                     |
| `pnpm test:watch`  | Vitest watch                                        |
| `pnpm typecheck`   | TypeScript no-emit                                  |
| `pnpm lint`        | ESLint via `next lint`                              |
| `pnpm db:generate` | Generate Drizzle migration                          |
| `pnpm db:migrate`  | Apply migrations to the file db                     |
| `pnpm db:studio`   | Open Drizzle Studio                                 |

## Architecture

See [`docs/superpowers/specs/2026-05-19-team-budget-design.md`](docs/superpowers/specs/2026-05-19-team-budget-design.md).

## Project layout

- `src/server/domain/` — pure business logic (tested heavily)
- `src/server/bot/` — grammY handlers
- `src/server/db/` — Drizzle schema and client
- `src/server/jobs/` — node-cron schedulers
- `src/app/` — Next.js routes
- `drizzle/` — generated migrations
- `tests/` — Vitest tests
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README quickstart"
```

---

### Task I3: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

- [ ] **Step 2: Verify locally**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: add github actions workflow"
```

---

## End of Plan 1

After this plan ships:

- **Backend complete**: all domain functions, all tables, the bot can authenticate users via `/start`, the cron schedules dues, login via Telegram works end-to-end on the web.
- **The web UI is bare**: just `/` and `/login`. No dashboard, members, charges pages, etc.
- **Bot is minimal**: only `/start`, `/help`, `/menu` (with stub callbacks).
- **No notifications, no spendings/payments via bot.**

**Plan 2** (Web UI) will be authored after this lands. It can incorporate any pattern lessons from this implementation (e.g., conventions around server actions, error handling, form structure).

**Plan 3** (Bot conversations, mini app, notifications, Docker) follows Plan 2.
