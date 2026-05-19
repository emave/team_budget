# Team Budget — Plan 3: Bot UX, Notifications, Mini App, Deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the bot conversational write flows, push notifications for the three event types, the Telegram Mini App, and Docker-based self-host deployment. After this plan, v1 is shippable.

**Architecture:**
- **Bot conversations** use the `@grammyjs/conversations` plugin for stateful multi-step flows (each command becomes a conversation that asks for inputs in sequence with inline keyboards).
- **Notifications** are post-action helpers that resolve a user's `telegram_user_id` and call `bot.api.sendMessage`. Charges/payments/dues actions invoke the helpers after their domain functions return; failures are swallowed (logged) so notification problems never block the mutation.
- **Mini app** is a parenthesized layout group `src/app/(mini)/mini/*` in Next.js that imports Telegram's `telegram-web-app.js` script, reads `themeParams`, and renders the same content as the desktop UI with a compact layout + bottom tab nav. Bot's `/menu` exposes an "Open mini app" button via grammY's `web_app` markup.
- **Deployment** uses a multi-stage Dockerfile producing Next.js `standalone` output, run as a single container with a host-mounted volume for the SQLite file. `docker-compose.yml` makes the dev/prod flow one command.

**Tech Stack:**
- `@grammyjs/conversations` (~1.x)
- Telegram's `telegram-web-app.js` loaded as a `<script>` tag (no extra npm SDK)
- Multi-stage Dockerfile (node:20-alpine base)

**Reference docs:**
- Spec: [`docs/superpowers/specs/2026-05-19-team-budget-design.md`](../specs/2026-05-19-team-budget-design.md) (§7 Bot UX, §8.2 mini app, §12 Deployment)
- Plan 1: foundation + domain
- Plan 2: web UI (server-action and `*-server.ts` wrapper patterns established here are reused)

**Scope of this plan:**
- ✅ Bot conversational write flows (`/spend`, `/pay`, `/charge`, `/invite`, `/info_edit`)
- ✅ Bot read commands (`/balance`, `/history`, `/info`)
- ✅ Bot menu callbacks (replace Plan 1 D4 stubs)
- ✅ Three notification types: new charge, payment received, monthly dues rollover
- ✅ Telegram Mini App at `/mini/*`
- ✅ Mini-app button in bot menu
- ✅ Dockerfile + docker-compose
- ✅ README deployment guide
- ❌ Out of scope: per-conversation analytics, advanced bot UX polish (typing indicators, message editing), light/dark theme switcher in web UI, audit log

**Conventions:**
- Domain functions stay pure — notifications are dispatched by the *caller* (server action or cron), not by the domain.
- Bot conversations live in `src/server/bot/conversations/*.ts`, registered in `src/server/bot/index.ts`.
- Notification helpers live in `src/server/bot/notifications.ts` and are called from `src/server/actions/*.ts` (or `src/server/jobs/*.ts`) wrapped in try/catch.
- Mini-app routes are server components; the only client-side concern is the WebApp init/theme.

---

## Phase A — Bot Infrastructure

### Task A1: Install conversations plugin + write notification helpers

**Files:**
- Modify: `package.json` (add `@grammyjs/conversations`)
- Modify: `src/server/bot/context.ts` (extend BotContext with `Conversation` flavor)
- Create: `src/server/bot/notifications.ts`
- Create: `tests/bot/notifications.test.ts`

- [ ] **Step 1: Install**

```bash
pnpm add @grammyjs/conversations
```

- [ ] **Step 2: Extend `src/server/bot/context.ts`**

```ts
import type { Context, SessionFlavor } from 'grammy';
import type { ConversationFlavor, Conversation } from '@grammyjs/conversations';
import type { Db } from '@/server/domain/types';
import type { users } from '@/server/db/schema';

export interface SessionData {} // empty for now — conversations stores its own state

export interface BotContextProps {
  db: Db;
  currentUser: typeof users.$inferSelect | null;
}

export type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor & BotContextProps;
export type BotConversation = Conversation<BotContext>;
```

- [ ] **Step 3: Write the failing notification test**

`tests/bot/notifications.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import {
  makeNotifier,
  type SendMessage,
} from '@/server/bot/notifications';

describe('notifier', () => {
  let db: TestDb;
  let sent: { chatId: number; text: string }[];
  let send: SendMessage;

  beforeEach(async () => {
    db = createTestDb();
    sent = [];
    send = async (chatId, text) => {
      sent.push({ chatId, text });
    };
  });

  it('notifyUser sends to the user’s telegram id', async () => {
    const u = await createUser(db, { telegramUserId: 42, displayName: 'Alice', role: 'member' });
    const notifier = makeNotifier({ db, send });
    await notifier.notifyUser(u.id, 'Hello');
    expect(sent).toEqual([{ chatId: 42, text: 'Hello' }]);
  });

  it('notifyUser is a no-op for unknown user', async () => {
    const notifier = makeNotifier({ db, send });
    await notifier.notifyUser('ghost-id', 'Hello');
    expect(sent).toEqual([]);
  });

  it('notifyAllActive sends to every active user', async () => {
    await createUser(db, { telegramUserId: 10, displayName: 'A', role: 'admin' });
    await createUser(db, { telegramUserId: 20, displayName: 'B', role: 'member' });
    const inactive = await createUser(db, { telegramUserId: 30, displayName: 'C', role: 'member' });
    const { deactivateUser } = await import('@/server/domain/users');
    await deactivateUser(db, inactive.id);

    const notifier = makeNotifier({ db, send });
    await notifier.notifyAllActive('Heads up');
    expect(sent.map((s) => s.chatId).sort()).toEqual([10, 20]);
  });

  it('swallows send errors and logs them', async () => {
    const failing: SendMessage = async () => { throw new Error('telegram is angry'); };
    const u = await createUser(db, { telegramUserId: 42, displayName: 'A', role: 'admin' });
    const notifier = makeNotifier({ db, send: failing });
    // Should not throw
    await notifier.notifyUser(u.id, 'x');
  });
});
```

- [ ] **Step 4: Verify failure**

Run: `pnpm test tests/bot/notifications.test.ts` → FAIL (module not found).

- [ ] **Step 5: Implement `src/server/bot/notifications.ts`**

```ts
import 'server-only';
import { eq } from 'drizzle-orm';
import { users } from '@/server/db/schema';
import type { Db } from '@/server/domain/types';

export type SendMessage = (chatId: number, text: string) => Promise<void>;

export interface Notifier {
  notifyUser(userId: string, text: string): Promise<void>;
  notifyAllActive(text: string): Promise<void>;
}

export function makeNotifier(deps: { db: Db; send: SendMessage }): Notifier {
  async function safeSend(chatId: number, text: string) {
    try {
      await deps.send(chatId, text);
    } catch (err) {
      console.error(`[notify] failed to send to chat ${chatId}:`, err);
    }
  }

  return {
    async notifyUser(userId, text) {
      const u = deps.db.select().from(users).where(eq(users.id, userId)).get();
      if (!u) return;
      await safeSend(u.telegramUserId, text);
    },
    async notifyAllActive(text) {
      const active = deps.db.select().from(users).where(eq(users.isActive, true)).all();
      await Promise.all(active.map((u) => safeSend(u.telegramUserId, text)));
    },
  };
}

// Production notifier: gets the bot lazily to avoid circular import at module load.
let _prodNotifier: Notifier | null = null;
export function getNotifier(): Notifier {
  if (!_prodNotifier) {
    const { getBot } = require('./index') as typeof import('./index');
    const { getDb } = require('@/server/db/client') as typeof import('@/server/db/client');
    _prodNotifier = makeNotifier({
      db: getDb(),
      send: async (chatId, text) => {
        await getBot().api.sendMessage(chatId, text);
      },
    });
  }
  return _prodNotifier;
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm test tests/bot/notifications.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "bot: conversations plugin install + notification helpers"
```

After: 152 total tests (148 + 4).

---

### Task A2: Wire conversations middleware into bot

**Files:**
- Modify: `src/server/bot/index.ts`

- [ ] **Step 1: Update `src/server/bot/index.ts`**

```ts
import 'server-only';
import { Bot, session } from 'grammy';
import { conversations } from '@grammyjs/conversations';
import { env } from '@/server/env';
import { getDb } from '@/server/db/client';
import { identifyUser, type BotContext } from './middleware';
import { registerStartHandler } from './handlers/start';
import { registerHelpHandler } from './handlers/help';
import { registerMenuHandler } from './handlers/menu';

let _bot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!_bot) {
    _bot = new Bot<BotContext>(env().BOT_TOKEN);
    _bot.use(session({ initial: () => ({}) }));
    _bot.use(conversations());
    _bot.use((ctx, next) => {
      ctx.db = getDb();
      return next();
    });
    _bot.use(identifyUser);
    registerStartHandler(_bot, { bootstrapAdminTelegramId: env().BOOTSTRAP_ADMIN_TELEGRAM_ID });
    registerHelpHandler(_bot);
    registerMenuHandler(_bot);
  }
  return _bot;
}

export async function startBot() {
  const bot = getBot();
  await bot.start({ drop_pending_updates: true });
}
```

The `session` middleware is required for `conversations` to store conversation state. Default in-memory storage is fine for a single-process self-host.

- [ ] **Step 2: Update tests that construct bots manually**

The bot tests in `tests/bot/*.test.ts` construct ad-hoc `Bot<BotContext>` instances without `session` + `conversations`. Since the existing handlers don't use conversations (they're plain commands), existing tests should still pass. Verify by running `pnpm test tests/bot/`.

If any test fails because it references `ctx.conversation`, add `session` + `conversations` middleware to that test's bot setup the same way as in `getBot()`.

- [ ] **Step 3: Verify**

```bash
pnpm test && pnpm typecheck && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "bot: wire grammy session + conversations middleware"
```

---

## Phase B — Bot Read Commands

### Task B1: `/balance` handler

**Files:**
- Create: `src/server/bot/handlers/balance.ts`
- Modify: `src/server/bot/index.ts` (register the handler)
- Create: `tests/bot/balance.test.ts`

- [ ] **Step 1: Failing test**

`tests/bot/balance.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerBalanceHandler } from '@/server/bot/handlers/balance';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'Test', username: 'test_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', { botInfo: BOT_INFO });
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
  bot.use((ctx, next) => { ctx.db = db; return next(); });
  bot.use(identifyUser);
  registerBalanceHandler(bot);
  return { bot, replies };
}

function balanceUpdate(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/balance',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 8 }],
    },
  };
}

describe('/balance', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('rejects unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(999));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows zero balance when no debt', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(5));
    expect(replies.join('\n')).toMatch(/settled/i);
  });

  it('lists open charges with total', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    await createAdhocCharge(db, { userId: m.id, amount: 5000, description: 'gear', createdByUserId: admin.id });
    await createAdhocCharge(db, { userId: m.id, amount: 3000, description: 'misc', createdByUserId: admin.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(5));
    const out = replies.join('\n');
    expect(out).toMatch(/80\.00/);
    expect(out).toMatch(/gear/);
    expect(out).toMatch(/misc/);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test tests/bot/balance.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/server/bot/handlers/balance.ts`**

```ts
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { listOpenChargesForMember, getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';

export function registerBalanceHandler(bot: Bot<BotContext>) {
  bot.command('balance', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
      return;
    }
    const settings = await getOrCreateSettings(ctx.db);
    const total = await getMemberOutstandingDebt(ctx.db, ctx.currentUser.id);
    if (total === 0) {
      await ctx.reply(`✅ You are settled.`);
      return;
    }
    const charges = await listOpenChargesForMember(ctx.db, ctx.currentUser.id);
    const lines = charges.map((c) => `  • ${formatCents(c.amount, settings.currency)} — ${c.description}`);
    await ctx.reply(`💰 You owe ${formatCents(total, settings.currency)}:\n${lines.join('\n')}`);
  });
}
```

- [ ] **Step 4: Register in `src/server/bot/index.ts`**

Add to imports:
```ts
import { registerBalanceHandler } from './handlers/balance';
```
Inside `getBot()`, after the existing registers, add:
```ts
registerBalanceHandler(_bot);
```

- [ ] **Step 5: Run tests + commit**

```bash
pnpm test tests/bot/balance.test.ts
git add .
git commit -m "bot: /balance handler"
```

After: 155 total tests.

---

### Task B2: `/history` handler

**Files:**
- Create: `src/server/bot/handlers/history.ts`
- Modify: `src/server/bot/index.ts`
- Create: `tests/bot/history.test.ts`

- [ ] **Step 1: Failing test**

`tests/bot/history.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createAdhocCharge } from '@/server/domain/charges';
import { recordPayment } from '@/server/domain/payments';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerHistoryHandler } from '@/server/bot/handlers/history';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'T', username: 't_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', { botInfo: BOT_INFO });
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({ ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' } } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => { ctx.db = db; return next(); });
  bot.use(identifyUser);
  registerHistoryHandler(bot);
  return { bot, replies };
}

function update(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/history',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 8 }],
    },
  };
}

describe('/history', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('rejects unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(999));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows empty history for a fresh member', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    expect(replies.join('\n')).toMatch(/no recent activity/i);
  });

  it('lists charges + payments for the user', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const c = await createAdhocCharge(db, { userId: m.id, amount: 1000, description: 'gear', createdByUserId: admin.id });
    await recordPayment(db, {
      payerUserId: m.id, method: 'cash', amount: 1000,
      allocations: [{ chargeId: c.id, amount: 1000 }],
      createdByUserId: admin.id,
    });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    const out = replies.join('\n');
    expect(out).toMatch(/gear/);
    expect(out).toMatch(/cash/);
  });
});
```

- [ ] **Step 2: Verify failure → implement → pass**

`src/server/bot/handlers/history.ts`:
```ts
import { desc, eq } from 'drizzle-orm';
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { charges, payments } from '@/server/db/schema';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';

export function registerHistoryHandler(bot: Bot<BotContext>) {
  bot.command('history', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
      return;
    }
    const settings = await getOrCreateSettings(ctx.db);
    const myCharges = ctx.db
      .select()
      .from(charges)
      .where(eq(charges.userId, ctx.currentUser.id))
      .orderBy(desc(charges.createdAt))
      .limit(10)
      .all();
    const myPayments = ctx.db
      .select()
      .from(payments)
      .where(eq(payments.payerUserId, ctx.currentUser.id))
      .orderBy(desc(payments.createdAt))
      .limit(10)
      .all();

    const events = [
      ...myCharges.map((c) => ({ at: c.createdAt, line: `🧾 ${formatCents(c.amount, settings.currency)} — ${c.description} [${c.status}]` })),
      ...myPayments.map((p) => ({ at: p.createdAt, line: `💵 ${formatCents(p.amount, settings.currency)} (${p.method})${p.cancelledAt ? ' [cancelled]' : ''}` })),
    ].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 10);

    if (events.length === 0) {
      await ctx.reply('No recent activity.');
      return;
    }
    await ctx.reply(`📜 Recent activity:\n${events.map((e) => e.line).join('\n')}`);
  });
}
```

Register in `src/server/bot/index.ts` (add import + call inside `getBot()`).

- [ ] **Step 3: Tests + commit**

```bash
pnpm test tests/bot/history.test.ts
git add .
git commit -m "bot: /history handler"
```

After: 158 total tests.

---

### Task B3: `/info` handler with inline keyboard

**Files:**
- Create: `src/server/bot/handlers/info.ts`
- Modify: `src/server/bot/index.ts`
- Create: `tests/bot/info.test.ts`

- [ ] **Step 1: Failing test**

`tests/bot/info.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { createInfoPage } from '@/server/domain/info-pages';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerInfoHandler } from '@/server/bot/handlers/info';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'T', username: 't_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', { botInfo: BOT_INFO });
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage' || method === 'editMessageText') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({ ok: true, result: true } as never);
    }
    if (method === 'answerCallbackQuery') {
      return Promise.resolve({ ok: true, result: true } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => { ctx.db = db; return next(); });
  bot.use(identifyUser);
  registerInfoHandler(bot);
  return { bot, replies };
}

function infoUpdate(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/info',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 5 }],
    },
  };
}

describe('/info', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('rejects unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(infoUpdate(999));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows no-entries message when empty', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(infoUpdate(5));
    expect(replies.join('\n')).toMatch(/no info entries/i);
  });

  it('lists info pages by title', async () => {
    const a = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    await createInfoPage(db, { title: 'Card details', body: 'Send to 1234', updatedByUserId: a.id });
    await createInfoPage(db, { title: 'How to pay', body: 'Use /pay', updatedByUserId: a.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(infoUpdate(5));
    const out = replies.join('\n');
    expect(out).toMatch(/info/i);
    // titles appear in the inline keyboard buttons — the reply text mentions "Tap"
    expect(out).toMatch(/tap/i);
  });
});
```

- [ ] **Step 2: Implement `src/server/bot/handlers/info.ts`**

```ts
import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { listInfoPages } from '@/server/domain/info-pages';
import { eq } from 'drizzle-orm';
import { infoPages } from '@/server/db/schema';

export function registerInfoHandler(bot: Bot<BotContext>) {
  bot.command('info', async (ctx) => {
    if (!ctx.currentUser) {
      await ctx.reply('You are not a team member yet. Ask your admin for an invite link.');
      return;
    }
    const pages = await listInfoPages(ctx.db);
    if (pages.length === 0) {
      await ctx.reply('No info entries yet.');
      return;
    }
    const kb = new InlineKeyboard();
    pages.forEach((p, i) => {
      kb.text(p.title.slice(0, 40), `info:${p.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    await ctx.reply('ℹ️ Tap an entry:', { reply_markup: kb });
  });

  bot.callbackQuery(/^info:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    if (!id) {
      await ctx.answerCallbackQuery({ text: 'Invalid info reference.' });
      return;
    }
    const page = ctx.db.select().from(infoPages).where(eq(infoPages.id, id)).get();
    if (!page) {
      await ctx.answerCallbackQuery({ text: 'Entry not found.' });
      return;
    }
    await ctx.answerCallbackQuery();
    await ctx.reply(`*${page.title}*\n\n${page.body}`, { parse_mode: 'Markdown' });
  });
}
```

Register in `src/server/bot/index.ts`.

- [ ] **Step 3: Tests + commit**

```bash
pnpm test tests/bot/info.test.ts
git add .
git commit -m "bot: /info handler with inline keyboard"
```

After: 161 total tests.

---

## Phase C — Bot Admin Write Flows

### Task C1: `/invite` — generate invite link

**Files:**
- Create: `src/server/bot/handlers/invite.ts`
- Modify: `src/server/bot/index.ts`

This one is simple — no conversation needed.

- [ ] **Step 1: Implement `src/server/bot/handlers/invite.ts`**

```ts
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { createInvite } from '@/server/domain/invites';
import { env } from '@/server/env';

export function registerInviteHandler(bot: Bot<BotContext>) {
  bot.command('invite', async (ctx) => {
    if (ctx.currentUser?.role !== 'admin') {
      await ctx.reply('This command is for admins only.');
      return;
    }
    const inv = await createInvite(ctx.db, { createdByUserId: ctx.currentUser.id });
    const url = `https://t.me/${env().BOT_USERNAME}?start=invite_${inv.token}`;
    await ctx.reply(`✅ Invite link (single-use):\n${url}`);
  });
}
```

Register in `src/server/bot/index.ts`.

- [ ] **Step 2: Test**

`tests/bot/invite.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { createTestDb, type TestDb } from '../helpers/db';
import { createUser } from '@/server/domain/users';
import { identifyUser, type BotContext } from '@/server/bot/middleware';
import { registerInviteHandler } from '@/server/bot/handlers/invite';

const BOT_INFO = {
  id: 1, is_bot: true, first_name: 'T', username: 't_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
};

function setup(db: TestDb) {
  process.env.BOT_TOKEN = 'test:0123456789';
  process.env.BOT_USERNAME = 'test_bot';
  process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'a'.repeat(32);

  const replies: string[] = [];
  const bot = new Bot<BotContext>('123:abc', { botInfo: BOT_INFO });
  bot.api.config.use((prev, method, payload) => {
    if (method === 'sendMessage') {
      replies.push((payload as { text: string }).text);
      return Promise.resolve({ ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' } } as never);
    }
    return prev(method, payload);
  });
  bot.use((ctx, next) => { ctx.db = db; return next(); });
  bot.use(identifyUser);
  registerInviteHandler(bot);
  return { bot, replies };
}

function update(fromId: number) {
  return {
    update_id: 1,
    message: {
      message_id: 1, date: Math.floor(Date.now() / 1000),
      from: { id: fromId, is_bot: false, first_name: 'X' },
      chat: { id: fromId, type: 'private' as const, first_name: 'X' },
      text: '/invite',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 7 }],
    },
  };
}

describe('/invite', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('admin only', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    expect(replies.join('\n')).toMatch(/admins only/i);
  });

  it('admin gets a link', async () => {
    await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(1));
    expect(replies.join('\n')).toMatch(/t\.me\/test_bot\?start=invite_/);
  });
});
```

- [ ] **Step 3: Commit**

```bash
pnpm test tests/bot/invite.test.ts
git add .
git commit -m "bot: /invite handler"
```

After: 163 total tests.

---

### Task C2: `/spend` — conversational record-spending

**Files:**
- Create: `src/server/bot/conversations/spend.ts`
- Modify: `src/server/bot/index.ts` (register conversation)
- Create: `tests/bot/spend.test.ts`

Conversations testing pattern: grammY conversations are stateful and hard to unit-test with raw update injection. Instead, write integration-style tests that simulate the user typing replies — or skip e2e bot testing entirely (the underlying domain functions are already tested). We'll write a minimal happy-path test using grammY's conversation testing pattern.

Looking at `@grammyjs/conversations` docs: testing conversations requires special setup. For pragmatic v1, we **skip dedicated conversation tests** and rely on:
1. The underlying domain function tests (already exist)
2. Manual smoke testing per the README

Instead, the test for this task verifies that the conversation is *registered* — i.e., sending `/spend` invokes our handler chain. We don't simulate multi-step user replies.

- [ ] **Step 1: Implement `src/server/bot/conversations/spend.ts`**

```ts
import type { BotContext, BotConversation } from '../context';
import { recordSpending } from '@/server/domain/spendings';
import { parseDollarsToCents } from '@/shared/format';
import { listCategories } from '@/server/domain/categories';
import { getNotifier } from '../notifications';
import { InlineKeyboard } from 'grammy';

export async function spendConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;

  // Step 1: pot
  await ctx.reply('Which pot?', {
    reply_markup: new InlineKeyboard().text('💵 Cash', 'spend:pot:cash').text('💳 Card', 'spend:pot:card'),
  });
  const potCtx = await conversation.waitForCallbackQuery(/^spend:pot:(cash|card)$/);
  await potCtx.answerCallbackQuery();
  const pot = potCtx.match[1] as 'cash' | 'card';

  // Step 2: amount
  await ctx.reply('Amount? (e.g., 12.50)');
  const amountCtx = await conversation.waitFor('message:text');
  let amountCents: number;
  try {
    amountCents = parseDollarsToCents(amountCtx.message.text);
  } catch {
    await ctx.reply('Invalid amount. Aborted.');
    return;
  }

  // Step 3: description
  await ctx.reply('Description?');
  const descCtx = await conversation.waitFor('message:text');
  const description = descCtx.message.text;

  // Step 4: category (optional)
  const cats = await listCategories(ctx.db);
  let categoryId: string | undefined;
  if (cats.length > 0) {
    const catKb = new InlineKeyboard();
    catKb.text('— none —', 'spend:cat:none').row();
    cats.forEach((c, i) => {
      catKb.text(c.name, `spend:cat:${c.id}`);
      if ((i + 1) % 2 === 0) catKb.row();
    });
    await ctx.reply('Category?', { reply_markup: catKb });
    const catCtx = await conversation.waitForCallbackQuery(/^spend:cat:(.+)$/);
    await catCtx.answerCallbackQuery();
    const picked = catCtx.match[1];
    categoryId = picked === 'none' ? undefined : picked;
  }

  // Record
  const s = await recordSpending(ctx.db, { pot, amount: amountCents, description, categoryId: categoryId ?? null, createdByUserId: adminId });
  await ctx.reply(`✅ Recorded ${pot} spending of ${(s.amount / 100).toFixed(2)}.`);
  // No notification — spendings are pot-only, no member is charged
}
```

- [ ] **Step 2: Register in `src/server/bot/index.ts`**

Add imports:
```ts
import { createConversation } from '@grammyjs/conversations';
import { spendConversation } from './conversations/spend';
```

Inside `getBot()`, after `conversations()` middleware and after `identifyUser`:
```ts
_bot.use(createConversation(spendConversation, 'spend'));
_bot.command('spend', async (ctx) => { await ctx.conversation.enter('spend'); });
```

- [ ] **Step 3: Smoke test**

`tests/bot/spend.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { spendConversation } from '@/server/bot/conversations/spend';

describe('spend conversation', () => {
  it('module loads and exports a function', () => {
    expect(typeof spendConversation).toBe('function');
  });
});
```

- [ ] **Step 4: Test + commit**

```bash
pnpm test && pnpm typecheck && pnpm build
git add .
git commit -m "bot: /spend conversation (admin records pot spending)"
```

After: 164 total tests.

---

### Task C3: `/pay` — conversational record-payment

**Files:**
- Create: `src/server/bot/conversations/pay.ts`
- Modify: `src/server/bot/index.ts`
- Create: `tests/bot/pay.test.ts`

- [ ] **Step 1: Implement `src/server/bot/conversations/pay.ts`**

```ts
import type { BotContext, BotConversation } from '../context';
import { recordPayment, fifoAllocate } from '@/server/domain/payments';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { listActiveMembers } from '@/server/domain/users';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { getNotifier } from '../notifications';
import { InlineKeyboard } from 'grammy';

export async function payConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;
  const settings = await getOrCreateSettings(ctx.db);

  // Step 1: payer
  const members = await listActiveMembers(ctx.db);
  if (members.length === 0) {
    await ctx.reply('No active members.');
    return;
  }
  const memberKb = new InlineKeyboard();
  members.forEach((m, i) => {
    memberKb.text(m.displayName, `pay:m:${m.id}`);
    if ((i + 1) % 2 === 0) memberKb.row();
  });
  await ctx.reply('Who paid?', { reply_markup: memberKb });
  const memCtx = await conversation.waitForCallbackQuery(/^pay:m:(.+)$/);
  await memCtx.answerCallbackQuery();
  const payerId = memCtx.match[1]!;

  // Step 2: amount
  const debt = await getMemberOutstandingDebt(ctx.db, payerId);
  if (debt === 0) {
    await ctx.reply(`That member is settled. Aborted.`);
    return;
  }
  await ctx.reply(`They owe ${formatCents(debt, settings.currency)}. Amount paid?`);
  const amountCtx = await conversation.waitFor('message:text');
  let cents: number;
  try {
    cents = parseDollarsToCents(amountCtx.message.text);
  } catch {
    await ctx.reply('Invalid amount. Aborted.');
    return;
  }
  if (cents > debt) {
    await ctx.reply(`Amount exceeds outstanding debt (${formatCents(debt, settings.currency)}). Aborted.`);
    return;
  }

  // Step 3: method
  await ctx.reply('Cash or card?', {
    reply_markup: new InlineKeyboard().text('💵 Cash', 'pay:method:cash').text('💳 Card', 'pay:method:card'),
  });
  const methodCtx = await conversation.waitForCallbackQuery(/^pay:method:(cash|card)$/);
  await methodCtx.answerCallbackQuery();
  const method = methodCtx.match[1] as 'cash' | 'card';

  // Step 4: FIFO allocate
  const allocations = await fifoAllocate(ctx.db, payerId, cents);

  // Step 5: record
  await recordPayment(ctx.db, {
    payerUserId: payerId,
    method,
    amount: cents,
    allocations,
    createdByUserId: adminId,
  });

  const remaining = debt - cents;
  await ctx.reply(
    `✅ Recorded ${method} payment of ${formatCents(cents, settings.currency)}. Remaining: ${formatCents(remaining, settings.currency)}.`,
  );
  // Notify the payer
  try {
    await getNotifier().notifyUser(
      payerId,
      `💵 Payment ${formatCents(cents, settings.currency)} (${method}) recorded. Remaining: ${formatCents(remaining, settings.currency)}.`,
    );
  } catch (err) {
    console.error('[pay] notify failed:', err);
  }
}
```

- [ ] **Step 2: Register**

In `src/server/bot/index.ts`:
```ts
import { payConversation } from './conversations/pay';
// ...
_bot.use(createConversation(payConversation, 'pay'));
_bot.command('pay', async (ctx) => { await ctx.conversation.enter('pay'); });
```

- [ ] **Step 3: Smoke test + commit**

```ts
// tests/bot/pay.test.ts
import { describe, it, expect } from 'vitest';
import { payConversation } from '@/server/bot/conversations/pay';

describe('pay conversation', () => {
  it('module loads', () => {
    expect(typeof payConversation).toBe('function');
  });
});
```

```bash
pnpm test && pnpm typecheck && pnpm build
git add .
git commit -m "bot: /pay conversation with FIFO allocation"
```

After: 165 total tests.

---

### Task C4: `/charge` — conversational create-charge (adhoc / split / pot-borrow)

**Files:**
- Create: `src/server/bot/conversations/charge.ts`
- Modify: `src/server/bot/index.ts`
- Create: `tests/bot/charge.test.ts`

- [ ] **Step 1: Implement `src/server/bot/conversations/charge.ts`**

```ts
import type { BotContext, BotConversation } from '../context';
import {
  createAdhocCharge,
  createPotBorrow,
  createSplitCharge,
} from '@/server/domain/charges';
import { parseDollarsToCents, formatCents } from '@/shared/format';
import { listActiveMembers } from '@/server/domain/users';
import { getOrCreateSettings } from '@/server/domain/settings';
import { getNotifier } from '../notifications';
import { InlineKeyboard } from 'grammy';

export async function chargeConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;
  const settings = await getOrCreateSettings(ctx.db);

  await ctx.reply('Charge type?', {
    reply_markup: new InlineKeyboard()
      .text('🧾 Single member', 'charge:type:adhoc')
      .row()
      .text('🧮 Split', 'charge:type:split')
      .row()
      .text('💰 Pot borrow', 'charge:type:pot_borrow'),
  });
  const typeCtx = await conversation.waitForCallbackQuery(/^charge:type:(adhoc|split|pot_borrow)$/);
  await typeCtx.answerCallbackQuery();
  const type = typeCtx.match[1];

  const members = await listActiveMembers(ctx.db);
  if (members.length === 0) {
    await ctx.reply('No active members.');
    return;
  }

  if (type === 'adhoc' || type === 'pot_borrow') {
    // pick member
    const kb = new InlineKeyboard();
    members.forEach((m, i) => {
      kb.text(m.displayName, `charge:m:${m.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    await ctx.reply('Member?', { reply_markup: kb });
    const mCtx = await conversation.waitForCallbackQuery(/^charge:m:(.+)$/);
    await mCtx.answerCallbackQuery();
    const userId = mCtx.match[1]!;

    await ctx.reply('Amount?');
    const amountCtx = await conversation.waitFor('message:text');
    let cents: number;
    try { cents = parseDollarsToCents(amountCtx.message.text); }
    catch { await ctx.reply('Invalid amount. Aborted.'); return; }

    let sourcePot: 'cash' | 'card' = 'cash';
    if (type === 'pot_borrow') {
      await ctx.reply('From which pot?', {
        reply_markup: new InlineKeyboard().text('💵 Cash', 'charge:pot:cash').text('💳 Card', 'charge:pot:card'),
      });
      const potCtx = await conversation.waitForCallbackQuery(/^charge:pot:(cash|card)$/);
      await potCtx.answerCallbackQuery();
      sourcePot = potCtx.match[1] as 'cash' | 'card';
    }

    await ctx.reply('Description?');
    const descCtx = await conversation.waitFor('message:text');
    const description = descCtx.message.text;

    if (type === 'adhoc') {
      await createAdhocCharge(ctx.db, { userId, amount: cents, description, createdByUserId: adminId });
    } else {
      await createPotBorrow(ctx.db, { userId, amount: cents, sourcePot, description, createdByUserId: adminId });
    }
    await ctx.reply(`✅ Created ${type} charge of ${formatCents(cents, settings.currency)}.`);
    try {
      await getNotifier().notifyUser(
        userId,
        `🧾 New charge: ${description} ${formatCents(cents, settings.currency)}. Type /balance to see total.`,
      );
    } catch (err) { console.error('[charge] notify failed:', err); }
    return;
  }

  // Split flow
  await ctx.reply('Description?');
  const descCtx = await conversation.waitFor('message:text');
  const description = descCtx.message.text;

  await ctx.reply('Per-member amount (same for everyone)? (e.g., 80.00)');
  const amtCtx = await conversation.waitFor('message:text');
  let perCents: number;
  try { perCents = parseDollarsToCents(amtCtx.message.text); }
  catch { await ctx.reply('Invalid amount. Aborted.'); return; }

  // Default: all active members. Allow admin to pick instead.
  const kb = new InlineKeyboard()
    .text('Everyone', 'charge:split:all')
    .row();
  members.forEach((m, i) => {
    kb.text(m.displayName, `charge:split:${m.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  kb.row().text('✅ Done', 'charge:split:done');

  const picked = new Set<string>();
  await ctx.reply('Pick members (tap names to toggle, then ✅ Done):', { reply_markup: kb });
  while (true) {
    const c = await conversation.waitForCallbackQuery(/^charge:split:(.+)$/);
    await c.answerCallbackQuery();
    const v = c.match[1]!;
    if (v === 'all') { members.forEach((m) => picked.add(m.id)); }
    else if (v === 'done') break;
    else {
      if (picked.has(v)) picked.delete(v);
      else picked.add(v);
    }
    await c.reply(`Selected: ${Array.from(picked).map((id) => members.find((m) => m.id === id)?.displayName ?? id).join(', ') || '(none)'}`);
  }
  if (picked.size === 0) { await ctx.reply('No members selected. Aborted.'); return; }

  const allocations = Array.from(picked).map((id) => ({ userId: id, amount: perCents }));
  await createSplitCharge(ctx.db, { description, allocations, createdByUserId: adminId });
  await ctx.reply(`✅ Created split charge: ${formatCents(perCents, settings.currency)} × ${picked.size} members.`);
  try {
    for (const id of picked) {
      await getNotifier().notifyUser(id, `🧾 New charge: ${description} ${formatCents(perCents, settings.currency)}. Type /balance to see total.`);
    }
  } catch (err) { console.error('[charge] split notify failed:', err); }
}
```

- [ ] **Step 2: Register**

In `src/server/bot/index.ts`:
```ts
import { chargeConversation } from './conversations/charge';
// ...
_bot.use(createConversation(chargeConversation, 'charge'));
_bot.command('charge', async (ctx) => { await ctx.conversation.enter('charge'); });
```

- [ ] **Step 3: Smoke test + commit**

```ts
// tests/bot/charge.test.ts
import { describe, it, expect } from 'vitest';
import { chargeConversation } from '@/server/bot/conversations/charge';

describe('charge conversation', () => {
  it('module loads', () => {
    expect(typeof chargeConversation).toBe('function');
  });
});
```

```bash
pnpm test && pnpm typecheck && pnpm build
git add .
git commit -m "bot: /charge conversation (adhoc/split/pot-borrow)"
```

After: 166 total tests.

---

### Task C5: `/info_edit` — manage FAQ entries

**Files:**
- Create: `src/server/bot/conversations/info-edit.ts`
- Modify: `src/server/bot/index.ts`
- Create: `tests/bot/info-edit.test.ts`

- [ ] **Step 1: Implement `src/server/bot/conversations/info-edit.ts`**

```ts
import type { BotContext, BotConversation } from '../context';
import {
  listInfoPages,
  createInfoPage,
  updateInfoPage,
  deleteInfoPage,
} from '@/server/domain/info-pages';
import { InlineKeyboard } from 'grammy';

export async function infoEditConversation(conversation: BotConversation, ctx: BotContext) {
  if (ctx.currentUser?.role !== 'admin') {
    await ctx.reply('This command is for admins only.');
    return;
  }
  const adminId = ctx.currentUser.id;

  const pages = await listInfoPages(ctx.db);
  const kb = new InlineKeyboard();
  pages.forEach((p, i) => {
    kb.text(p.title.slice(0, 30), `infoed:edit:${p.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  kb.row().text('➕ New entry', 'infoed:new');
  await ctx.reply('Select an entry to edit, or create a new one:', { reply_markup: kb });

  const choice = await conversation.waitForCallbackQuery(/^infoed:(edit|new)(?::(.+))?$/);
  await choice.answerCallbackQuery();
  const mode = choice.match[1];

  if (mode === 'new') {
    await ctx.reply('Title?');
    const tCtx = await conversation.waitFor('message:text');
    await ctx.reply('Body? (Markdown supported)');
    const bCtx = await conversation.waitFor('message:text');
    await createInfoPage(ctx.db, { title: tCtx.message.text, body: bCtx.message.text, updatedByUserId: adminId });
    await ctx.reply('✅ Created.');
    return;
  }

  // edit
  const id = choice.match[2]!;
  await ctx.reply('Action?', {
    reply_markup: new InlineKeyboard()
      .text('✏️ Edit', `infoed:do:edit:${id}`)
      .text('🗑️ Delete', `infoed:do:delete:${id}`),
  });
  const action = await conversation.waitForCallbackQuery(/^infoed:do:(edit|delete):(.+)$/);
  await action.answerCallbackQuery();
  const what = action.match[1];
  if (what === 'delete') {
    await deleteInfoPage(ctx.db, id);
    await ctx.reply('🗑️ Deleted.');
    return;
  }
  await ctx.reply('New title? (or send `.` to keep current)');
  const tCtx = await conversation.waitFor('message:text');
  await ctx.reply('New body? (or send `.` to keep current)');
  const bCtx = await conversation.waitFor('message:text');
  await updateInfoPage(ctx.db, id, {
    title: tCtx.message.text === '.' ? undefined : tCtx.message.text,
    body: bCtx.message.text === '.' ? undefined : bCtx.message.text,
    updatedByUserId: adminId,
  });
  await ctx.reply('✅ Updated.');
}
```

- [ ] **Step 2: Register**

In `src/server/bot/index.ts`:
```ts
import { infoEditConversation } from './conversations/info-edit';
// ...
_bot.use(createConversation(infoEditConversation, 'infoEdit'));
_bot.command('info_edit', async (ctx) => { await ctx.conversation.enter('infoEdit'); });
```

- [ ] **Step 3: Smoke test + commit**

```ts
// tests/bot/info-edit.test.ts
import { describe, it, expect } from 'vitest';
import { infoEditConversation } from '@/server/bot/conversations/info-edit';

describe('info_edit conversation', () => {
  it('module loads', () => {
    expect(typeof infoEditConversation).toBe('function');
  });
});
```

```bash
pnpm test && pnpm typecheck && pnpm build
git add .
git commit -m "bot: /info_edit conversation (admin manage FAQ)"
```

After: 167 total tests.

---

## Phase D — Menu Callbacks

### Task D1: Wire `menu:*` callbacks

**Files:**
- Modify: `src/server/bot/handlers/menu.ts`

In Plan 1 the menu callback was a stub returning "Coming soon." Now we wire it to dispatch to the appropriate command or conversation.

- [ ] **Step 1: Update `src/server/bot/handlers/menu.ts`**

Replace the stub callback with real dispatch:
```ts
import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { env } from '@/server/env';

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
      .text('ℹ️ Info', 'menu:info')
      .row()
      .webApp('📱 Open mini app', `${env().NEXT_PUBLIC_BASE_URL}/mini`);
    if (ctx.currentUser.role === 'admin') {
      kb.row()
        .text('🔧 New charge', 'menu:charge')
        .text('💵 Record payment', 'menu:pay')
        .row()
        .text('🛒 Record spending', 'menu:spend')
        .text('🔗 Invite', 'menu:invite');
    }
    await ctx.reply(`Main menu — ${ctx.currentUser.displayName}`, { reply_markup: kb });
  });

  bot.callbackQuery('menu:balance', async (ctx) => {
    await ctx.answerCallbackQuery();
    // Delegate by sending a fake /balance via context — easier: replicate balance handler inline
    const { getMemberOutstandingDebt, listOpenChargesForMember } = await import('@/server/domain/charges');
    const { getOrCreateSettings } = await import('@/server/domain/settings');
    const { formatCents } = await import('@/shared/format');
    if (!ctx.currentUser) return;
    const s = await getOrCreateSettings(ctx.db);
    const total = await getMemberOutstandingDebt(ctx.db, ctx.currentUser.id);
    if (total === 0) { await ctx.reply('✅ You are settled.'); return; }
    const cs = await listOpenChargesForMember(ctx.db, ctx.currentUser.id);
    const lines = cs.map((c) => `  • ${formatCents(c.amount, s.currency)} — ${c.description}`);
    await ctx.reply(`💰 You owe ${formatCents(total, s.currency)}:\n${lines.join('\n')}`);
  });

  bot.callbackQuery('menu:history', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Type /history to see your activity.' });
  });

  bot.callbackQuery('menu:info', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Type /info to browse entries.' });
  });

  bot.callbackQuery('menu:charge', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    await ctx.conversation.enter('charge');
  });
  bot.callbackQuery('menu:pay', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    await ctx.conversation.enter('pay');
  });
  bot.callbackQuery('menu:spend', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    await ctx.conversation.enter('spend');
  });
  bot.callbackQuery('menu:invite', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply('Admins only.'); return; }
    const { createInvite } = await import('@/server/domain/invites');
    const inv = await createInvite(ctx.db, { createdByUserId: ctx.currentUser.id });
    await ctx.reply(`✅ Invite link:\nhttps://t.me/${env().BOT_USERNAME}?start=invite_${inv.token}`);
  });
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm typecheck && pnpm build
```

Note: TS may complain about `webApp` not existing on `InlineKeyboard`. If so, use `.url(label, url)` and accept that it'll open in the user's browser rather than as a Telegram WebApp inline. The proper WebApp button uses `{ text, web_app: { url } }` in raw markup:
```ts
const kb = new InlineKeyboard();
// ... add normal buttons
// then append a row with raw web_app markup
const baseMarkup = kb.inline_keyboard;
baseMarkup.push([{ text: '📱 Open mini app', web_app: { url: `${env().NEXT_PUBLIC_BASE_URL}/mini` } }]);
```
Adjust as needed. The existing `InlineKeyboard.webApp(label, url)` IS supported in grammY 1.x — but verify by trying it first.

- [ ] **Step 3: Test + commit**

The existing `tests/bot/help-menu.test.ts` should still pass since the menu command itself is unchanged structurally. Verify:
```bash
pnpm test tests/bot/help-menu.test.ts
```

```bash
git add .
git commit -m "bot: wire menu:* callbacks to commands and conversations"
```

---

## Phase E — Notifications

### Task E1: New-charge notifications from charge actions

**Files:**
- Modify: `src/server/actions/charges.ts` (hook notifications)

We hook into the **server actions** (not domain). Web UI dispatches via actions; the bot's `/charge` conversation already calls notify directly (Task C4). For the web UI path:

- [ ] **Step 1: Modify `src/server/actions/charges.ts`**

After the `createAdhocCharge` action body, notify the user. After `createSplitCharge`, notify each user. After `createPotBorrow`, notify the user.

Add the import at top:
```ts
import { getNotifier } from '@/server/bot/notifications';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
```

For each action, wrap the notify in try/catch (so notify failure doesn't break the mutation). Update `createAdhocCharge`:
```ts
const createAdhocCharge = adminAction(async ({ user, db }, input: unknown) => {
  const p = createAdhocChargeSchema.parse(input);
  const charge = await domainAdhoc(db, { ...p, createdByUserId: user.id });
  try {
    const settings = await getOrCreateSettings(db);
    await getNotifier().notifyUser(
      p.userId,
      `🧾 New charge: ${p.description} ${formatCents(charge.amount, settings.currency)}. Type /balance to see total.`,
    );
  } catch (err) { console.error('[actions] notify failed:', err); }
  return charge;
});
```

For `createPotBorrow`, the same pattern (notify the single member):
```ts
const createPotBorrow = adminAction(async ({ user, db }, input: unknown) => {
  const p = createPotBorrowSchema.parse(input);
  const charge = await domainPotBorrow(db, { ...p, createdByUserId: user.id });
  if (process.env.SKIP_BOT !== '1') {
    try {
      const settings = await getOrCreateSettings(db);
      await getNotifier().notifyUser(
        p.userId,
        `💰 You borrowed ${formatCents(charge.amount, settings.currency)} from the ${p.sourcePot} pot: ${p.description}. Type /balance to see total.`,
      );
    } catch (err) { console.error('[actions] notify failed:', err); }
  }
  return charge;
});
```

For `createSplitCharge`, notify each member in the allocation list:
```ts
const createSplitCharge = adminAction(async ({ user, db }, input: unknown) => {
  const p = createSplitChargeSchema.parse(input);
  const result = await domainSplit(db, { ...p, createdByUserId: user.id });
  if (process.env.SKIP_BOT !== '1') {
    try {
      const settings = await getOrCreateSettings(db);
      for (const a of p.allocations) {
        await getNotifier().notifyUser(
          a.userId,
          `🧾 New shared charge: ${p.description} ${formatCents(a.amount, settings.currency)}. Type /balance to see total.`,
        );
      }
    } catch (err) { console.error('[actions] notify failed:', err); }
  }
  return result;
});
```

- [ ] **Step 2: Verify build + tests**

```bash
pnpm test && pnpm typecheck && pnpm build
```

Note: the existing tests for these actions (in `tests/actions/charges.test.ts`) might fail if `getNotifier()` is called during tests and the bot can't be initialized. The notifier's prod constructor lazily requires `./index` which requires the env. If tests fail, **guard the notifier inside the action**:
```ts
if (process.env.SKIP_BOT !== '1') {
  try {
    // ... notify
  } catch (err) { console.error('[actions] notify failed:', err); }
}
```
And set `process.env.SKIP_BOT = '1'` in the action test setup.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "notify: DM member on new charge (adhoc, split, pot-borrow)"
```

---

### Task E2: Payment-received notification

**Files:**
- Modify: `src/server/actions/payments.ts`

- [ ] **Step 1: Modify `src/server/actions/payments.ts`**

```ts
import { getNotifier } from '@/server/bot/notifications';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { getMemberOutstandingDebt } from '@/server/domain/charges';

// inside recordPayment action body, after domainRecord:
const result = await domainRecord(db, { ...p, createdByUserId: user.id });
if (process.env.SKIP_BOT !== '1') {
  try {
    const settings = await getOrCreateSettings(db);
    const remaining = await getMemberOutstandingDebt(db, p.payerUserId);
    await getNotifier().notifyUser(
      p.payerUserId,
      `💵 Payment ${formatCents(result.payment.amount, settings.currency)} (${result.payment.method}) recorded. Remaining: ${formatCents(remaining, settings.currency)}.`,
    );
  } catch (err) { console.error('[actions] notify failed:', err); }
}
return result;
```

- [ ] **Step 2: Test + commit**

```bash
pnpm test && pnpm typecheck && pnpm build
git add .
git commit -m "notify: DM member on payment recorded"
```

---

### Task E3: Monthly-dues-generated notification

**Files:**
- Modify: `src/server/jobs/monthly-dues.ts` (notify after generation)
- Modify: `src/server/actions/settings.ts` (notify when admin runs dues now)

- [ ] **Step 1: Modify `src/server/jobs/monthly-dues.ts`**

In `runMonthlyDuesOnce`, after `generateMonthlyDues` returns, notify all active members if `createdCount > 0`:

```ts
import { getNotifier } from '../bot/notifications';
import { getOrCreateSettings } from '../domain/settings';
import { formatCents } from '@/shared/format';

export async function runMonthlyDuesOnce(db: Db, opts: RunOptions = {}) {
  const period = currentBillingPeriod(opts.now);
  const adminId = await pickSystemAdmin(db);
  const result = await generateMonthlyDues(db, { period, createdByUserId: adminId });

  if (result.createdCount > 0 && process.env.SKIP_BOT !== '1') {
    try {
      const settings = await getOrCreateSettings(db);
      await getNotifier().notifyAllActive(
        `📅 Monthly dues for ${period} have been added (${formatCents(settings.monthlyDuesAmount, settings.currency)}). Type /balance to see total.`,
      );
    } catch (err) { console.error('[dues] notify failed:', err); }
  }

  return result;
}
```

- [ ] **Step 2: No change needed in `settings.ts`** — `runDuesNow` action already calls `runMonthlyDuesOnce`, which now handles notification.

- [ ] **Step 3: Test + commit**

```bash
pnpm test && pnpm typecheck && pnpm build
git add .
git commit -m "notify: DM all active on monthly dues rollover"
```

---

## Phase F — Mini App

### Task F1: Mini app foundation (layout + WebApp init + theme)

**Files:**
- Create: `src/app/(mini)/layout.tsx`
- Create: `src/app/(mini)/mini/init.tsx`
- Create: `src/app/(mini)/mini/page.tsx`

- [ ] **Step 1: Write `src/app/(mini)/layout.tsx`**

`(mini)` is a parenthesized layout group, sibling of `(app)`. Root layout (in `src/app/layout.tsx`) already wraps everything in `<Providers>`, so this layout just adds the WebApp script tag and a compact wrapper.

```tsx
import type { ReactNode } from 'react';
import Script from 'next/script';
import { requireUser } from '@/server/auth/server-helpers';
import { bootOnce } from '@/server/boot';

export default async function MiniLayout({ children }: { children: ReactNode }) {
  await bootOnce();
  await requireUser();
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?56" strategy="beforeInteractive" />
      <main style={{ padding: 12, maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>{children}</main>
    </>
  );
}
```

- [ ] **Step 2: Write `src/app/(mini)/mini/init.tsx`** (client component for WebApp init)

```tsx
'use client';

import { useEffect } from 'react';

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

export function MiniInit() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    // Apply theme tokens via CSS variables on document.body
    Object.entries(tg.themeParams).forEach(([k, v]) => {
      document.body.style.setProperty(`--tg-${k.replace(/_/g, '-')}`, v);
    });
    if (tg.themeParams.bg_color) {
      document.body.style.background = tg.themeParams.bg_color;
    }
    if (tg.themeParams.text_color) {
      document.body.style.color = tg.themeParams.text_color;
    }
  }, []);
  return null;
}
```

- [ ] **Step 3: Write `src/app/(mini)/mini/page.tsx`** (mini dashboard)

```tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getPotBalances } from '@/server/domain/pots';
import { getOrCreateSettings } from '@/server/domain/settings';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { formatCents } from '@/shared/format';
import { MiniInit } from './init';
import { MiniTabs } from './tabs';

export default async function MiniDashboard() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const debt = await getMemberOutstandingDebt(db, user.id);
  const pots = await getPotBalances(db);
  return (
    <>
      <MiniInit />
      <div style={{ padding: 16, background: debt > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>
          {debt > 0 ? 'You owe' : 'Settled'}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{formatCents(debt, settings.currency)}</div>
      </div>
      {user.role === 'admin' && (
        <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          Cash: {formatCents(pots.cash, settings.currency)} · Card: {formatCents(pots.card, settings.currency)}
        </div>
      )}
      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 4: Build verify (MiniTabs comes in F2)**

For F1 alone, stub the tabs import. Create a placeholder `src/app/(mini)/mini/tabs.tsx`:
```tsx
export function MiniTabs() {
  return <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>Tabs coming in F2.</div>;
}
```

- [ ] **Step 5: Commit**

```bash
pnpm typecheck && pnpm build
git add .
git commit -m "mini: layout + WebApp init + dashboard scaffold"
```

---

### Task F2: Mini pages (charges, payments, info) + bottom tab nav

**Files:**
- Replace: `src/app/(mini)/mini/tabs.tsx` (with real bottom nav)
- Create: `src/app/(mini)/mini/charges/page.tsx`
- Create: `src/app/(mini)/mini/payments/page.tsx`
- Create: `src/app/(mini)/mini/info/page.tsx`

- [ ] **Step 1: Replace `src/app/(mini)/mini/tabs.tsx`** with real bottom nav

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/mini', label: 'Home' },
  { href: '/mini/charges', label: 'Charges' },
  { href: '/mini/payments', label: 'Payments' },
  { href: '/mini/info', label: 'Info' },
];

export function MiniTabs() {
  const pathname = usePathname();
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
      background: '#fff', borderTop: '1px solid #e5e7eb', padding: '8px 0',
    }}>
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} style={{
            textAlign: 'center', color: active ? '#16a34a' : '#6b7280',
            fontWeight: active ? 600 : 400, fontSize: 13, textDecoration: 'none',
          }}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Make sure pages reserve bottom space (`paddingBottom: 60` on `main`). Update `src/app/(mini)/layout.tsx`:
```tsx
<main style={{ padding: 12, maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>{children}</main>
```

- [ ] **Step 2: Create `src/app/(mini)/mini/charges/page.tsx`** (member-scoped charges)

```tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listChargesFiltered } from '@/server/domain/charges';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';

export default async function MiniChargesPage() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const rows = await listChargesFiltered(db, { userId: user.id, limit: 50 });
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Your charges</h2>
      <div>
        {rows.map((c) => (
          <div key={c.id} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 4px', borderTop: '1px solid #f3f4f6', fontSize: 13,
          }}>
            <span>{c.description}</span>
            <span style={{ color: c.status === 'paid' ? '#16a34a' : c.status === 'cancelled' ? '#6b7280' : '#dc2626' }}>
              {formatCents(c.amount, settings.currency)} ({c.status})
            </span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>None.</div>}
      </div>
      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 3: Create `src/app/(mini)/mini/payments/page.tsx`**

```tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listPaymentsByPayer } from '@/server/domain/payments';
import { getOrCreateSettings } from '@/server/domain/settings';
import { formatCents } from '@/shared/format';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';

export default async function MiniPaymentsPage() {
  const user = await requireUser();
  const db = getDb();
  const settings = await getOrCreateSettings(db);
  const rows = await listPaymentsByPayer(db, user.id);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Your payments</h2>
      <div>
        {rows.map((p) => (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 4px', borderTop: '1px solid #f3f4f6', fontSize: 13,
          }}>
            <span>{new Date(p.receivedAt).toLocaleDateString()} · {p.method}</span>
            <span>{formatCents(p.amount, settings.currency)}</span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#6b7280' }}>None.</div>}
      </div>
      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 4: Create `src/app/(mini)/mini/info/page.tsx`**

```tsx
import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { listInfoPages } from '@/server/domain/info-pages';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';

export default async function MiniInfoPage() {
  await requireUser();
  const db = getDb();
  const pages = await listInfoPages(db);
  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Info</h2>
      {pages.map((p) => (
        <article key={p.id} style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, margin: '8px 0 4px' }}>{p.title}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: 13 }}>{p.body}</pre>
        </article>
      ))}
      {pages.length === 0 && <div style={{ color: '#6b7280' }}>No entries.</div>}
      <MiniTabs />
    </>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
pnpm typecheck && pnpm build
git add .
git commit -m "mini: charges, payments, info pages + bottom tab nav"
```

---

### Task F3: Bot mini-app button + verify menu

**Files:**
- Modify: `src/server/bot/handlers/menu.ts` (verify webApp button works)

D1 already added the `webApp` button. If it didn't compile cleanly there, use the raw markup form:

- [ ] **Step 1: Verify menu produces a WebApp button**

Check that `bot.command('menu', ...)` includes a button with `web_app: { url: ... }` in the markup. If using `InlineKeyboard.webApp(label, url)` doesn't work, use this pattern instead:

```ts
import type { InlineKeyboardButton } from 'grammy/types';

const buttons: InlineKeyboardButton[][] = [
  [{ text: '💰 Balance', callback_data: 'menu:balance' }, { text: '📜 History', callback_data: 'menu:history' }],
  [{ text: 'ℹ️ Info', callback_data: 'menu:info' }],
  [{ text: '📱 Open mini app', web_app: { url: `${env().NEXT_PUBLIC_BASE_URL}/mini` } }],
];
if (ctx.currentUser.role === 'admin') {
  buttons.push(
    [{ text: '🔧 New charge', callback_data: 'menu:charge' }, { text: '💵 Record payment', callback_data: 'menu:pay' }],
    [{ text: '🛒 Record spending', callback_data: 'menu:spend' }, { text: '🔗 Invite', callback_data: 'menu:invite' }],
  );
}
await ctx.reply(`Main menu — ${ctx.currentUser.displayName}`, {
  reply_markup: { inline_keyboard: buttons },
});
```

- [ ] **Step 2: Commit**

```bash
pnpm typecheck && pnpm build
git add .
git commit -m "bot: mini-app WebApp button in /menu"
```

---

## Phase G — Deployment

### Task G1: Dockerfile

**Files:**
- Create: `Dockerfile`
- Modify: `next.config.mjs` (add `output: 'standalone'`)

- [ ] **Step 1: Update `next.config.mjs`**

Add `output: 'standalone'` at the top level:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
    serverComponentsExternalPackages: ['better-sqlite3', 'grammy'],
  },
};
export default nextConfig;
```

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++ sqlite

# Deps stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# Build-time placeholder env so next.config + page rendering can resolve;
# real values come from runtime env at container start.
ENV BOT_TOKEN=build-time-placeholder
ENV BOT_USERNAME=build-placeholder
ENV BOOTSTRAP_ADMIN_TELEGRAM_ID=1
ENV NEXT_PUBLIC_BASE_URL=http://localhost:3000
ENV SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
RUN corepack enable && pnpm build

# Runtime stage
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```

- [ ] **Step 3: Verify build (docker may not be available; if so, do `pnpm build` and check `.next/standalone/server.js` exists)**

```bash
pnpm build
ls -la .next/standalone/server.js
```

Optionally, if Docker is available locally:
```bash
docker build -t team-budget:dev .
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "deploy: Dockerfile (multi-stage, standalone output)"
```

---

### Task G2: docker-compose.yml

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env.example` (add deployment notes)

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  team-budget:
    build: .
    image: team-budget:latest
    container_name: team-budget
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=/data/team_budget.db
      - BOT_TOKEN=${BOT_TOKEN}
      - BOT_USERNAME=${BOT_USERNAME}
      - BOOTSTRAP_ADMIN_TELEGRAM_ID=${BOOTSTRAP_ADMIN_TELEGRAM_ID}
      - NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
      - CURRENCY=${CURRENCY:-USD}
      - SESSION_SECRET=${SESSION_SECRET}
    volumes:
      - ./data:/data
    command: sh -c "node scripts/migrate.js || tsx scripts/migrate.ts; node server.js"
```

Note: `scripts/migrate.ts` is TypeScript; the standalone Node image may not have `tsx`. The simpler approach is to compile the migration script as part of the build OR run migrations via the host before bringing the container up. For v1, document the migration step in the README — the container expects the DB to already be migrated.

Update the command to skip migration (admin runs `pnpm db:migrate` outside the container before start):
```yaml
    command: ["node", "server.js"]
```

- [ ] **Step 2: Append deployment block to `.env.example`** (no actual code changes — already complete)

Actually no change needed; the existing `.env.example` already lists all needed env vars.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "deploy: docker-compose.yml"
```

---

### Task G3: README deployment guide

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append to `README.md`**

After the existing content, add:

```md

## Deployment

### Prerequisites

- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram numeric ID from [@userinfobot](https://t.me/userinfobot)
- A host with Docker installed and a public HTTPS URL (for the Telegram Mini App and Telegram Login Widget — see [Spec §12](docs/superpowers/specs/2026-05-19-team-budget-design.md#121-https-requirements))
- The HTTPS URL can come from Cloudflare Tunnel (free), a VPS with Let's Encrypt, or any other reverse proxy

### One-time setup

1. Configure the BotFather bot:
   - `/setdomain` → set your HTTPS domain (enables Telegram Login Widget)
   - `/newapp` → register a Telegram Mini App pointing at `https://yourdomain.com/mini`
2. Clone the repo and copy env:
   ```bash
   git clone <repo>
   cd team_budget
   cp .env.example .env
   # edit .env with your bot token, your telegram id, and your public URL
   ```
3. Generate a session secret:
   ```bash
   openssl rand -hex 32
   # paste into SESSION_SECRET in .env
   ```
4. Apply database migrations to the host volume:
   ```bash
   mkdir -p data
   pnpm install --frozen-lockfile
   DATABASE_URL=./data/team_budget.db pnpm db:migrate
   ```

### Run

```bash
docker compose up -d --build
docker compose logs -f
```

Visit your HTTPS URL. On first `/start` to your bot in Telegram, you (the bootstrap admin) will be created.

### Upgrades

```bash
git pull
DATABASE_URL=./data/team_budget.db pnpm db:migrate  # only when schema changes
docker compose up -d --build
```

### Backups

Back up the `./data` directory regularly — it contains the SQLite database with all team finance state.

### Without Docker

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

You'll need a process supervisor (systemd, pm2) to keep `pnpm start` alive across reboots.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: deployment guide for self-host"
```

---

## End of Plan 3

After this plan ships, **v1 is complete**:
- ✅ All 7 web pages working
- ✅ Bot has read commands + 5 admin write conversations + menu callbacks
- ✅ Three notification types
- ✅ Telegram Mini App at `/mini/*`
- ✅ Dockerfile + docker-compose
- ✅ README has the full deployment guide

### Manual smoke checklist after Plan 3

1. Bot: `/start`, then `/menu` — verify all buttons render including "📱 Open mini app"
2. Tap the mini-app button in Telegram — mini app should load with team's theme colors
3. Admin: `/charge` in bot → walk through split flow → confirm members get notification DMs
4. Admin: `/pay` → walk through → confirm payer gets notification DM
5. Settings (web): "Generate dues now" → all active members get DM
6. Docker: `docker compose up -d`, hit the URL, log in via Telegram, full happy-path
