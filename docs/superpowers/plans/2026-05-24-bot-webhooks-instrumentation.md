# Bot webhooks + instrumentation-driven startup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace lazy `bootOnce()`-on-page-render with Next.js `instrumentation.ts`; switch bot from long-polling to webhooks so it works without web traffic.

**Architecture:** `instrumentation.ts` runs `register()` once per Node process at startup — sets webhook with Telegram, publishes commands, starts cron. A new `POST /api/bot/webhook` route dispatches updates to grammy via `bot.handleUpdate`. The `bootOnce` indirection is deleted.

**Tech Stack:** Next.js 14.2 (App Router, standalone output), grammy 1.43, node-cron 4.2, zod for env, vitest for unit tests, better-sqlite3 + drizzle for DB.

**Spec:** [docs/superpowers/specs/2026-05-24-bot-webhooks-instrumentation-design.md](../specs/2026-05-24-bot-webhooks-instrumentation-design.md)

---

### Task 1: Add `TELEGRAM_WEBHOOK_SECRET` to env schema

**Files:**
- Modify: `src/server/env.ts`

- [ ] **Step 1: Add the field to the zod schema and test helper**

In `src/server/env.ts`, add to `EnvSchema`:

```ts
TELEGRAM_WEBHOOK_SECRET: z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,256}$/, 'must match Telegram secret_token charset')
  .optional(),
```

(Optional — only required when bot is enabled. The route handler and `instrumentation.ts` will fail loudly if missing in prod.)

Already-present `envForTest` doesn't need changes; tests that need the secret will pass it via `overrides`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

---

### Task 2: Refactor `bot/index.ts` — drop polling, expose webhook helpers

**Files:**
- Modify: `src/server/bot/index.ts`

- [ ] **Step 1: Replace `startBot()` with two exports**

In `src/server/bot/index.ts`, replace the existing `startBot` function (lines ~155-162) with:

```ts
export async function publishAllCommands(bot: Bot<BotContext>) {
  try { await publishCommands(bot); }
  catch (err) { console.error('[bot] publishCommands failed:', err); }
  try { await publishAdminCommandsForAllAdmins(bot); }
  catch (err) { console.error('[bot] publishAdminCommandsForAllAdmins failed:', err); }
}

export async function registerWebhook(bot: Bot<BotContext>) {
  const e = env();
  if (!e.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required to register a webhook');
  }
  const url = `${e.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')}/api/bot/webhook`;
  await bot.api.setWebhook(url, {
    secret_token: e.TELEGRAM_WEBHOOK_SECRET,
    drop_pending_updates: false,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (Existing references to `startBot` come from `boot.ts`, which we delete in Task 6.)

---

### Task 3: Webhook route — failing test (TDD)

**Files:**
- Create: `tests/api/bot-webhook.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/bot', () => ({
  getBot: vi.fn(),
}));

const setEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.BOT_TOKEN = 'test:0123456789';
  process.env.BOT_USERNAME = 'test_bot';
  process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'a'.repeat(32);
  process.env.TELEGRAM_WEBHOOK_SECRET = 'abc123';
};

describe('POST /api/bot/webhook', () => {
  beforeEach(() => {
    vi.resetModules();
    setEnv();
  });

  it('rejects requests without secret header', async () => {
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }));
    expect(res.status).toBe(401);
  });

  it('rejects requests with wrong secret', async () => {
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong', 'content-type': 'application/json' },
      body: '{}',
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON', async () => {
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'abc123', 'content-type': 'application/json' },
      body: 'not json',
    }));
    expect(res.status).toBe(400);
  });

  it('dispatches valid update to bot.handleUpdate and returns 200', async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    const { getBot } = await import('@/server/bot');
    (getBot as ReturnType<typeof vi.fn>).mockReturnValue({ handleUpdate: handle });
    const { POST } = await import('@/app/api/bot/webhook/route');
    const update = { update_id: 1, message: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '/start' } };
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'abc123', 'content-type': 'application/json' },
      body: JSON.stringify(update),
    }));
    expect(res.status).toBe(200);
    expect(handle).toHaveBeenCalledWith(update);
  });

  it('returns 200 even if handler throws (logs error)', async () => {
    const handle = vi.fn().mockRejectedValue(new Error('boom'));
    const { getBot } = await import('@/server/bot');
    (getBot as ReturnType<typeof vi.fn>).mockReturnValue({ handleUpdate: handle });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'abc123', 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 1 }),
    }));
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect failure (route doesn't exist yet)**

Run: `pnpm test tests/api/bot-webhook.test.ts`
Expected: FAIL with module-not-found for `@/app/api/bot/webhook/route`.

---

### Task 4: Webhook route — implementation

**Files:**
- Create: `src/app/api/bot/webhook/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { getBot } from '@/server/bot';
import { env } from '@/server/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = env().TELEGRAM_WEBHOOK_SECRET;
  const provided = req.headers.get('x-telegram-bot-api-secret-token');
  if (!secret || !provided || provided !== secret) {
    return new Response('forbidden', { status: 401 });
  }
  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  try {
    // grammy's Bot has a generic on Update; cast at the route boundary.
    await getBot().handleUpdate(update as Parameters<ReturnType<typeof getBot>['handleUpdate']>[0]);
  } catch (err) {
    console.error('[bot] handleUpdate failed:', err);
  }
  return new Response('ok', { status: 200 });
}
```

- [ ] **Step 2: Run the tests — expect all pass**

Run: `pnpm test tests/api/bot-webhook.test.ts`
Expected: 5 passing.

---

### Task 5: `instrumentation.ts` + Next.js config flag

**Files:**
- Create: `instrumentation.ts` (repo root)
- Modify: `next.config.mjs`

- [ ] **Step 1: Enable the experimental hook in `next.config.mjs`**

Replace the existing experimental block with:

```js
experimental: {
  instrumentationHook: true,
  serverActions: { allowedOrigins: ['localhost:3000'] },
  serverComponentsExternalPackages: ['better-sqlite3', 'grammy'],
},
```

- [ ] **Step 2: Create `instrumentation.ts`**

```ts
let registered: Promise<void> | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (registered) return registered;
  registered = (async () => {
    const { env } = await import('@/server/env');
    env();

    if (process.env.SKIP_BOT !== '1') {
      const { getBot, registerWebhook, publishAllCommands } = await import('@/server/bot');
      const bot = getBot();
      await registerWebhook(bot);
      await publishAllCommands(bot);
      console.log('[boot] bot webhook registered, commands published');
    } else {
      console.log('[boot] bot skipped (SKIP_BOT=1)');
    }

    if (process.env.SKIP_CRON !== '1') {
      const { scheduleMonthlyDues } = await import('@/server/jobs/monthly-dues');
      const { getDb } = await import('@/server/db/client');
      scheduleMonthlyDues(getDb);
      console.log('[boot] monthly dues cron scheduled');
    } else {
      console.log('[boot] cron skipped (SKIP_CRON=1)');
    }
  })();
  return registered;
}
```

(Imports are dynamic so the file can be loaded by Next.js's edge runtime without dragging in Node-only deps; the early `NEXT_RUNTIME` check skips edge anyway, but dynamic import is the safer convention here.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

---

### Task 6: Delete `boot.ts` and remove `bootOnce()` call sites

**Files:**
- Delete: `src/server/boot.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(mini)/layout.tsx`

- [ ] **Step 1: Remove `bootOnce` import and call from `src/app/page.tsx`**

After change, the file should be:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/server-helpers';

export default async function HomePage() {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  redirect('/dashboard');
}
```

- [ ] **Step 2: Remove `bootOnce` import and call from `src/app/(app)/layout.tsx`**

Remove the `import { bootOnce } from '@/server/boot';` line and the `await bootOnce();` line.

- [ ] **Step 3: Remove `bootOnce` import and call from `src/app/(mini)/layout.tsx`**

Same: remove the import and the call.

- [ ] **Step 4: Delete `src/server/boot.ts`**

Run: `rm src/server/boot.ts`

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

---

### Task 7: Update env files + Docker

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`
- Modify: `docker-compose.yml`
- Modify: `Dockerfile`

- [ ] **Step 1: Update `.env.example`**

Add at the bottom:

```
# Random string used as Telegram webhook secret_token header.
# Generate with: openssl rand -hex 16
TELEGRAM_WEBHOOK_SECRET=put-random-32-char-string-here
```

- [ ] **Step 2: Update `.env.local` — set SKIP_BOT=1 so dev doesn't fight prod bot**

Add at the bottom:

```
# Dev doesn't run the bot or cron by default. Unset (or set to 0) and
# add a tunneled webhook URL if you need to test bot flows locally.
SKIP_BOT=1
SKIP_CRON=1
```

- [ ] **Step 3: Update `docker-compose.yml` to pass the new env var**

In the `environment:` block, add the line:

```yaml
      - TELEGRAM_WEBHOOK_SECRET=${TELEGRAM_WEBHOOK_SECRET}
```

(Place it alongside the other secrets.)

- [ ] **Step 4: Add build-time placeholder in `Dockerfile`**

In the builder stage, next to the other build-time placeholders, add:

```dockerfile
ENV TELEGRAM_WEBHOOK_SECRET=build-time-placeholder
```

(SKIP_BOT=1 is already set so the placeholder is never used, but env validation will see a present value.)

---

### Task 8: Delete `tests/boot.test.ts`

**Files:**
- Delete: `tests/boot.test.ts`

- [ ] **Step 1: Delete the file**

Run: `rm tests/boot.test.ts`

It tested `bootOnce` which no longer exists.

---

### Task 9: Full verification

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: All tests pass. `tests/boot.test.ts` is gone; new `tests/api/bot-webhook.test.ts` passes.

- [ ] **Step 3: Production build**

Run: `SKIP_BOT=1 SKIP_CRON=1 BOT_TOKEN=build-time-placeholder BOT_USERNAME=build-placeholder BOOTSTRAP_ADMIN_TELEGRAM_ID=1 NEXT_PUBLIC_BASE_URL=http://localhost:3000 SESSION_SECRET=$(printf 'a%.0s' {1..32}) TELEGRAM_WEBHOOK_SECRET=build-time-placeholder pnpm build`
Expected: build succeeds. `instrumentation.ts` is bundled but doesn't run any side-effect work because SKIP_BOT=1 and SKIP_CRON=1.

---

### Task 10: Commit

- [ ] **Step 1: Stage and commit everything**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(bot): switch to webhooks + instrumentation-driven startup

Replace lazy bootOnce()-on-page-render with Next.js instrumentation.ts
so the bot and cron come up at process start instead of requiring a
web visit. Bot transport switches from long-polling to webhooks via a
new POST /api/bot/webhook route authenticated by TELEGRAM_WEBHOOK_SECRET.

Fixes intermittent "bot not responding" after container restarts: the
bot is now alive immediately on boot, no longer drops queued updates,
and crashes loudly on failure so Docker restart-policy recovers it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Instrumentation hook → Task 5 ✓
- Webhook route → Tasks 3 + 4 ✓
- Bot wiring refactor (delete polling, add registerWebhook/publishAllCommands) → Task 2 ✓
- Delete boot.ts + 3 call sites → Task 6 ✓
- Env additions (TELEGRAM_WEBHOOK_SECRET, dev SKIP_BOT default) → Tasks 1 + 7 ✓
- Docker propagation + build placeholder → Task 7 ✓
- Test replacement (delete boot.test, new webhook test) → Tasks 3 + 8 ✓
- Verification (typecheck/test/build) → Task 9 ✓
- Commit → Task 10 ✓

**Placeholder scan:** None — every step has the actual code/command.

**Type consistency:** `getBot()` keeps its existing signature; `registerWebhook(bot)` and `publishAllCommands(bot)` both take `Bot<BotContext>`; webhook route casts the parsed body at the boundary.
