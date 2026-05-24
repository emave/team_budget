# Bot webhooks + instrumentation-driven startup

**Status:** Approved 2026-05-24
**Author:** siarhei.semikau@instinctools.com (with Claude)

## Problem

The bot uses Telegram long-polling started lazily by `bootOnce()` in
`src/server/boot.ts`. `bootOnce()` is only called from three server
components (`src/app/page.tsx`, `src/app/(app)/layout.tsx`,
`src/app/(mini)/layout.tsx`). Consequences observed in production
(self-hosted Docker on TrueNAS):

1. After every container restart (Watchtower image pulls, host reboots,
   manual deploys), the bot stays dormant until a human visits the web
   app. The site sees little traffic — most use is via Telegram — so
   dormancy windows can last hours.
2. `bot.start({ drop_pending_updates: true })`
   (`src/server/bot/index.ts:161`) discards any Telegram updates queued
   during dormancy. The bot then runs fine, making the failure look
   intermittent ("sometimes the bot doesn't respond") rather than
   systemic.
3. `void startBot().catch(log)` (`src/server/boot.ts:18-20`) resolves
   `bootPromise` before `bot.start()` actually establishes polling, and
   swallows any post-start crash silently. There is no retry; the bot
   stays dead until the Node process restarts.
4. The same lazy-boot path also gates `scheduleMonthlyDues` — cron only
   runs if someone visited the web app.

The root cause is an architectural mismatch: lazy initialization
assumes inbound HTTP wakes things up, but long-polling requires the bot
to initiate the outbound connection. In a self-hosted Docker
deployment there is no reason for lazy init — the Node process runs
continuously and should boot the bot at process start, like any normal
backend.

## Goals

- Bot responsiveness is independent of web-app traffic.
- Cron jobs are independent of web-app traffic.
- A container restart fully restores bot functionality without manual
  intervention or page visits.
- No silently-swallowed boot failures.
- Local dev does not require a public tunnel and does not interfere
  with the production bot.

## Non-goals

- Migrating to a different bot framework or scheduler.
- Adding observability / metrics / healthcheck endpoints (can be a
  follow-up; the core fix doesn't need them).
- External cron via system crontab. Confirmed: in-process node-cron
  started by `instrumentation.ts` is the chosen model.

## Architecture

### Process-startup hook: `instrumentation.ts`

Next.js's standard mechanism for running code once per Node process at
server startup. Lives at the repo root (Next.js auto-discovers it).
`register()` is awaited before the server starts handling requests.

Gating:

- `process.env.NEXT_RUNTIME === 'nodejs'` — skip edge runtime.
- Bot setup is skipped when `process.env.SKIP_BOT === '1'`. Cron is
  skipped when `process.env.SKIP_CRON === '1'`. (Matches the existing
  split in `boot.ts`. Dockerfile build stage sets both to 1; dev
  `.env.local` sets both to 1 by default.)
- Idempotent against dev hot-reload: a module-scoped `Promise` caches
  the registration so a re-invoked `register()` is a no-op.

Next.js 14.2 requires `experimental.instrumentationHook: true` in
`next.config.mjs` for `instrumentation.ts` to be picked up. Add it.

What it does (in order, on prod):

1. Validate env via existing `env()` (must include the new
   `TELEGRAM_WEBHOOK_SECRET` when bot is enabled).
2. If bot is enabled: build the bot instance via `getBot()`, register
   the webhook with Telegram (`bot.api.setWebhook(
   ${NEXT_PUBLIC_BASE_URL}/api/bot/webhook,
   { secret_token: TELEGRAM_WEBHOOK_SECRET,
   drop_pending_updates: false })` — idempotent), then publish public
   commands and per-admin command scopes.
3. If cron is enabled: start `scheduleMonthlyDues(getDb)`.

Errors during steps 1–3: log loudly and **rethrow**. The Node process
should crash; Docker's `restart: unless-stopped` will reincarnate it.
This is preferable to the current swallow-and-stay-zombie behavior.

### Webhook route: `POST /api/bot/webhook`

File: `src/app/api/bot/webhook/route.ts`.

```
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (req.headers.get('x-telegram-bot-api-secret-token')
        !== env().TELEGRAM_WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 401 });
  }
  let update: unknown;
  try { update = await req.json(); }
  catch { return new Response('bad request', { status: 400 }); }

  const bot = getBot();
  try {
    await bot.handleUpdate(update as Update);
  } catch (err) {
    console.error('[bot] handleUpdate failed:', err);
  }
  return new Response('ok', { status: 200 });
}
```

Decisions:

- **200 even on handler error** (with logging). Telegram retries
  non-2xx aggressively; a buggy handler would compound the original
  problem. Errors must be logged.
- `force-dynamic` to ensure no caching at the route level.
- `runtime: 'nodejs'` — explicit, because grammy needs Node APIs.

### Bot wiring changes: `src/server/bot/index.ts`

- Keep `getBot()` as the lazy singleton — the same instance must be
  used by both the webhook route and `instrumentation.ts` so command
  publishing and update handling share state.
- Replace `startBot()` with two smaller exports:
  - `registerWebhook(bot)`: calls `bot.api.setWebhook(...)`.
  - `publishAllCommands(bot)`: wraps `publishCommands` and
    `publishAdminCommandsForAllAdmins` with try/catch logging.
- Delete the `bot.start(...)` long-polling call.
- Delete `drop_pending_updates: true` (not applicable to webhooks).

### Deletions

- `src/server/boot.ts` — entire file.
- `await bootOnce()` lines in:
  - `src/app/page.tsx`
  - `src/app/(app)/layout.tsx`
  - `src/app/(mini)/layout.tsx`
- `tests/boot.test.ts` — entire file (replaced by webhook test).

### Env

Add `TELEGRAM_WEBHOOK_SECRET` to:

- `src/server/env.ts` — required in prod, optional in dev (only used
  when `SKIP_BOT !== '1'`).
- `.env.example` — with placeholder and a comment explaining how to
  generate (`openssl rand -hex 16` produces 32 hex chars, the Telegram
  max).
- `.env.local` — set `SKIP_BOT=1` by default so the dev server runs
  without bot side-effects.
- `docker-compose.yml` — propagate from the host env file.
- `Dockerfile` build stage — set placeholder `TELEGRAM_WEBHOOK_SECRET=
  build-time-placeholder` next to other build-time placeholders. Build
  stage already has `SKIP_BOT=1` so the placeholder is never used.

### Data flow

**Production (Telegram → app):**

```
Telegram → HTTPS POST → Cloudflare Tunnel → Next.js server
  → /api/bot/webhook → verify secret_token
  → bot.handleUpdate(update) → grammy middleware chain
  → handlers → bot.api.sendMessage / reply / ...
```

**Production (cron):**

```
node-cron tick (in-process, scheduled by instrumentation.ts)
  → scheduleMonthlyDues handler → drizzle writes
```

**Dev:** `SKIP_BOT=1` short-circuits `register()`. No bot, no cron, no
webhook. Web app works normally for UI development.

## Testing

### Updated test layout

| File | Status |
|------|--------|
| `tests/boot.test.ts` | **delete** — covers a function that no longer exists |
| `tests/api/bot-webhook.test.ts` | **new** |
| `tests/bot/*.test.ts` | unchanged — they exercise grammy handlers directly via `bot.handleUpdate(fakeUpdate)` and don't depend on transport |

### `tests/api/bot-webhook.test.ts`

Three cases minimum:

1. **Missing/wrong secret header → 401.** No call to `bot.handleUpdate`.
2. **Valid secret + valid update payload → 200.** Verifies
   `bot.handleUpdate` was invoked with the parsed update.
3. **Valid secret + invalid JSON body → 400.**
4. **Valid secret + handler throws → still 200**, error is logged.

Implementation note: import the route handler directly
(`import { POST } from '@/app/api/bot/webhook/route'`) and call it
with a constructed `Request`. Mock the bot module's `getBot` to return
a stub with `handleUpdate: vi.fn()`.

## Deployment plan

1. Generate webhook secret on TrueNAS: `openssl rand -hex 16`.
2. Add `TELEGRAM_WEBHOOK_SECRET=<value>` to the env file used by
   docker-compose (alongside `BOT_TOKEN` etc.).
3. Pull the new image (Watchtower will do this automatically once it
   exists in GHCR, or `docker compose pull && docker compose up -d`).
4. On container start, `instrumentation.ts` calls `setWebhook`.
   Telegram immediately stops delivering via getUpdates and starts
   POSTing to `https://teambudget.org/api/bot/webhook`.
5. Sanity check: send `/balance` to the bot. Expect a reply within
   ~1s. If not, check container logs for `[bot] handleUpdate failed`
   or webhook setup errors.

### Rollback

Reverting the commit and redeploying restores polling. Telegram's
webhook setting is not auto-cleared by the old code — to force a
polling-only fallback after rolling back, run once manually:

```
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"
```

This is documented here so it's not a surprise during an incident.

## Risks

- **Telegram secret_token max length.** Telegram caps `secret_token`
  at 256 chars and restricts charset to `[A-Za-z0-9_-]`. `openssl rand
  -hex 16` (32 chars, hex) is comfortably under both limits.
- **Webhook URL must be HTTPS with a valid cert.** Cloudflare Tunnel
  already provides this. If the tunnel ever goes down, the bot stops
  receiving updates — but with polling the bot would still be down
  too, because the container itself is reached only via the tunnel.
  No net change in failure modes.
- **`bot.handleUpdate` is synchronous to grammy's middleware.** Long-
  running handlers will hold the request open. Telegram's webhook
  delivery has its own timeout (~60s) but `setMyCommands`-style API
  calls during handlers should remain fast. No new risk introduced
  here vs. polling.
- **Concurrent updates.** With webhooks, Telegram may POST multiple
  updates in parallel. The bot must be safe under concurrent calls —
  grammy's middleware is, and our handlers don't share mutable
  per-user state outside the DB / session. Conversations use grammy's
  per-chat lock; safe.
- **First deploy clears Telegram's getUpdates queue.** Telegram drops
  pending updates on `setWebhook` only if `drop_pending_updates: true`
  is passed; we pass `false`, so any pending updates from a
  pre-deploy outage will be delivered to the webhook. Net win.

## Open questions

None. Cron strategy and dev mode resolved in brainstorming. Polling
code deleted entirely (no `BOT_MODE` flag). 200-on-error confirmed.
