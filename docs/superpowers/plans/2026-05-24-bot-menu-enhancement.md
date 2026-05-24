# Bot Menu Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the bot's dual "balance + wallet" surface into a single signed-balance number, unify `/history` with credit-ledger events, fix broken `menu:*` callbacks, and expand the menu to expose all reachable commands.

**Architecture:** Display-only change. `credit_balance` and `outstanding_debt` stay as separate domain concepts; a new `getNetBalance` helper returns the signed difference. Each bot handler exports a `runX(ctx)` helper so `menu.ts` callbacks invoke the same logic as the corresponding command.

**Tech Stack:** TypeScript, Next.js 15, grammy bot framework, Vitest, Drizzle ORM (better-sqlite3), Telegram Bot API.

---

## Task 1: `getNetBalance` helper

**Files:**
- Modify: `src/server/domain/credit.ts` (append export at end of file)

- [ ] **Step 1: Add the helper**

At the end of `src/server/domain/credit.ts`, add:

```ts
import { getMemberOutstandingDebt } from './charges';

export async function getNetBalance(db: Db, userId: string): Promise<number> {
  const [credit, debt] = await Promise.all([
    getCreditBalance(db, userId),
    getMemberOutstandingDebt(db, userId),
  ]);
  return credit - debt;
}
```

Note: if `./charges` is already imported at the top of the file, fold the new symbol into the existing import statement; do **not** add a duplicate import line.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors. If there's a circular import warning between `credit.ts` and `charges.ts`, move `getNetBalance` to a new file `src/server/domain/balance.ts` instead and re-export from both.

- [ ] **Step 3: Commit**

```bash
git add src/server/domain/credit.ts
git commit -m "feat(domain): add getNetBalance helper"
```

---

## Task 2: Rewrite `/balance` to signed-number output

**Files:**
- Modify: `src/server/bot/handlers/balance.ts` (full rewrite)
- Modify: `src/shared/i18n/messages-en.ts` (add `balanceLine`)
- Modify: `src/shared/i18n/messages-ru.ts` (add `balanceLine`)
- Modify: `tests/bot/balance.test.ts` (update assertions)

- [ ] **Step 1: Add `balanceLine` i18n key (EN)**

In `src/shared/i18n/messages-en.ts`, inside the `bot: { ... }` block, add immediately after `settledYes`:

```ts
    balanceLine: (amount: string) => `💰 Your balance: ${amount}`,
```

- [ ] **Step 2: Add `balanceLine` i18n key (RU)**

In `src/shared/i18n/messages-ru.ts`, inside the `bot: { ... }` block, in the matching location:

```ts
    balanceLine: (amount: string) => `💰 Ваш баланс: ${amount}`,
```

- [ ] **Step 3: Update test assertions**

Replace `tests/bot/balance.test.ts`'s `describe('/balance', () => { ... })` block (lines 47-76) with:

```ts
describe('/balance', () => {
  let db: TestDb;
  beforeEach(() => { db = createTestDb(); });

  it('rejects unknown user', async () => {
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(999));
    expect(replies.join('\n')).toMatch(/not a team member/i);
  });

  it('shows zero balance for a fresh member', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(5));
    expect(replies.join('\n')).toMatch(/your balance: 0\.00/i);
  });

  it('shows negative balance when member has outstanding charges', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    await createAdhocCharge(db, { userId: m.id, amount: 5000, description: 'gear', createdByUserId: admin.id });
    await createAdhocCharge(db, { userId: m.id, amount: 3000, description: 'misc', createdByUserId: admin.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(balanceUpdate(5));
    expect(replies.join('\n')).toMatch(/your balance: -80\.00/i);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run tests/bot/balance.test.ts`
Expected: FAIL — current handler emits "You owe …" / "settled" rather than `Your balance: -X`.

- [ ] **Step 5: Rewrite the handler**

Replace the entire contents of `src/server/bot/handlers/balance.ts`:

```ts
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { getNetBalance } from '@/server/domain/credit';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';

export async function runBalance(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  if (!ctx.currentUser) {
    await ctx.reply(m.bot.notMember);
    return;
  }
  const net = await getNetBalance(ctx.db, ctx.currentUser.id);
  await ctx.reply(m.bot.balanceLine(formatCents(net)));
}

export function registerBalanceHandler(bot: Bot<BotContext>) {
  bot.command('balance', runBalance);
}
```

Note: this drops the admin-only team-overview append. Admins still reach team overview via `/team` and the menu's Team overview button.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/bot/balance.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/server/bot/handlers/balance.ts src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts tests/bot/balance.test.ts
git commit -m "feat(bot): /balance returns single signed net balance"
```

---

## Task 3: Unify `/history` with credit events; extract `runHistory`

**Files:**
- Modify: `src/server/bot/handlers/history.ts` (full rewrite)
- Modify: `tests/bot/history.test.ts` (add deposit/refund assertions, double-count guard)

- [ ] **Step 1: Add failing test cases**

Append to `tests/bot/history.test.ts` inside `describe('/history', ...)`:

```ts
  it('includes credit deposits in unified history', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { depositToWallet } = await import('@/server/domain/credit');
    await depositToWallet(db, { userId: m.id, amount: 2000, method: 'cash', createdByUserId: admin.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    expect(replies.join('\n')).toMatch(/deposited.*20\.00/i);
  });

  it('does not double-count payment_consumption alongside the charge', async () => {
    const admin = await createUser(db, { telegramUserId: 1, displayName: 'A', role: 'admin' });
    const m = await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { depositToWallet } = await import('@/server/domain/credit');
    await depositToWallet(db, { userId: m.id, amount: 5000, method: 'cash', createdByUserId: admin.id });
    await createAdhocCharge(db, { userId: m.id, amount: 1000, description: 'gear', createdByUserId: admin.id });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(update(5));
    const out = replies.join('\n');
    expect(out).toMatch(/gear/);
    expect(out).not.toMatch(/applied.*gear/i);
  });
```

Note: if `depositToWallet` is named differently in the credit domain, adjust the test import to match — search with `grep -n "^export.*deposit" src/server/domain/credit.ts` first.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run tests/bot/history.test.ts`
Expected: the two new tests FAIL — current handler doesn't surface credit events.

- [ ] **Step 3: Rewrite handler**

Replace the entire contents of `src/server/bot/handlers/history.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { charges, payments } from '@/server/db/schema';
import { listCreditHistory } from '@/server/domain/credit';
import { formatCents } from '@/shared/format';
import { botMessages } from '../i18n';
import { getMessages } from '@/shared/i18n';

const MAX_EVENTS = 10;

export async function runHistory(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  if (!ctx.currentUser) {
    await ctx.reply(m.bot.notMember);
    return;
  }
  const userId = ctx.currentUser.id;
  const locale = ctx.currentUser.locale;
  const wm = getMessages(locale).wallet.historyEvent;
  const cashLabel = getMessages(locale).common.cash;
  const cardLabel = getMessages(locale).common.card;

  const myCharges = ctx.db
    .select()
    .from(charges)
    .where(eq(charges.userId, userId))
    .orderBy(desc(charges.createdAt))
    .limit(MAX_EVENTS)
    .all();
  const myPayments = ctx.db
    .select()
    .from(payments)
    .where(eq(payments.payerUserId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(MAX_EVENTS)
    .all();
  const credit = await listCreditHistory(ctx.db, userId);

  type Row = { at: Date; line: string };
  const rows: Row[] = [];

  for (const c of myCharges) {
    rows.push({
      at: c.createdAt,
      line: m.bot.historyChargeLine(formatCents(c.amount), c.description, c.status),
    });
  }
  for (const p of myPayments) {
    rows.push({
      at: p.createdAt,
      line: m.bot.historyPaymentLine(formatCents(p.amount), p.method, !!p.cancelledAt),
    });
  }
  for (const e of credit) {
    if (e.kind === 'payment_consumption') continue; // avoid double-count with the underlying charge
    if (e.kind === 'payment_deposit') {
      rows.push({
        at: e.at,
        line: `💰 ${wm.payment_deposit(formatCents(e.amount), e.method === 'cash' ? cashLabel : cardLabel)}`,
      });
    } else if (e.kind === 'refund') {
      rows.push({
        at: e.at,
        line: `↩️ ${wm.refund(formatCents(e.amount), e.method === 'cash' ? cashLabel : cardLabel)}`,
      });
    } else if (e.kind === 'transfer_in') {
      rows.push({
        at: e.at,
        line: `↘️ ${wm.transfer_in(formatCents(e.amount), e.counterpartyDisplayName)}`,
      });
    } else if (e.kind === 'transfer_out') {
      rows.push({
        at: e.at,
        line: `↗️ ${wm.transfer_out(formatCents(e.amount), e.counterpartyDisplayName)}`,
      });
    }
  }

  const events = rows.sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, MAX_EVENTS);

  if (events.length === 0) {
    await ctx.reply(m.bot.historyEmpty);
    return;
  }
  await ctx.reply(`${m.bot.historyHeading}\n${events.map((e) => e.line).join('\n')}`);
}

export function registerHistoryHandler(bot: Bot<BotContext>) {
  bot.command('history', runHistory);
}
```

Note: `CreditEvent` may not expose `at`. Before pasting, run `grep -n "^export type CreditEvent\\|^      kind:\\|^      at:" src/server/domain/credit.ts` and check that each variant carries a timestamp field. If it's named differently (e.g. `createdAt`), substitute throughout. If credit events lack timestamps, they sort to the end of the list — wire one through `listCreditHistory` as a separate small change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/bot/history.test.ts`
Expected: all tests PASS (5 total).

- [ ] **Step 5: Commit**

```bash
git add src/server/bot/handlers/history.ts tests/bot/history.test.ts
git commit -m "feat(bot): unify /history with credit events"
```

---

## Task 4: Extract `runHelp` / `runInfo` / `runLanguage` helpers

No behavior change — just refactor so `menu.ts` can call the same logic.

**Files:**
- Modify: `src/server/bot/handlers/help.ts`
- Modify: `src/server/bot/handlers/info.ts`
- Modify: `src/server/bot/handlers/language.ts`

- [ ] **Step 1: Refactor `help.ts`**

Replace `src/server/bot/handlers/help.ts`:

```ts
import type { Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { botMessages } from '../i18n';

export async function runHelp(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  await ctx.reply(m.bot.helpText);
}

export function registerHelpHandler(bot: Bot<BotContext>) {
  bot.command('help', runHelp);
}
```

- [ ] **Step 2: Refactor `info.ts`**

In `src/server/bot/handlers/info.ts`, extract the command body into `runInfo`. The callback handler for `/^info:(.+)$/` stays inside `registerInfoHandler` untouched. Final shape:

```ts
import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { listInfoPages } from '@/server/domain/info-pages';
import { eq } from 'drizzle-orm';
import { infoPages } from '@/server/db/schema';
import { botMessages } from '../i18n';

export async function runInfo(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  if (!ctx.currentUser) {
    await ctx.reply(m.bot.notMember);
    return;
  }
  const pages = await listInfoPages(ctx.db);
  if (pages.length === 0) {
    await ctx.reply(m.bot.infoNoEntries);
    return;
  }
  const kb = new InlineKeyboard();
  pages.forEach((p, i) => {
    kb.text(p.title.slice(0, 40), `info:${p.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  await ctx.reply(m.bot.infoTapEntry, { reply_markup: kb });
}

export function registerInfoHandler(bot: Bot<BotContext>) {
  bot.command('info', runInfo);

  bot.callbackQuery(/^info:(.+)$/, async (ctx) => {
    const { m } = botMessages(ctx);
    const id = ctx.match[1];
    if (!id) {
      await ctx.answerCallbackQuery({ text: m.bot.infoInvalidRef });
      return;
    }
    const page = ctx.db.select().from(infoPages).where(eq(infoPages.id, id)).get();
    if (!page) {
      await ctx.answerCallbackQuery({ text: m.bot.infoNotFound });
      return;
    }
    await ctx.answerCallbackQuery();
    await ctx.reply(`*${page.title}*\n\n${page.body}`, { parse_mode: 'Markdown' });
  });
}
```

- [ ] **Step 3: Refactor `language.ts`**

In `src/server/bot/handlers/language.ts`, extract the command body into `runLanguage`. The `^lang:set:(en|ru)$` callback stays untouched. Final shape:

```ts
import { InlineKeyboard, type Bot } from 'grammy';
import type { BotContext } from '../middleware';
import { getMessages, type Locale } from '@/shared/i18n';
import { updateUserLocale } from '@/server/domain/users';
import { botMessages } from '../i18n';

export async function runLanguage(ctx: BotContext): Promise<void> {
  const { m } = botMessages(ctx);
  if (!ctx.currentUser) {
    await ctx.reply(m.bot.notMember);
    return;
  }
  await ctx.reply(m.bot.language.prompt, {
    reply_markup: new InlineKeyboard()
      .text(m.bot.language.btnEnglish, 'lang:set:en')
      .text(m.bot.language.btnRussian, 'lang:set:ru'),
  });
}

export function registerLanguageHandler(bot: Bot<BotContext>) {
  bot.command('language', runLanguage);

  bot.callbackQuery(/^lang:set:(en|ru)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.currentUser) {
      const { m } = botMessages(ctx);
      await ctx.reply(m.bot.notMember);
      return;
    }
    const next = ctx.match[1] as Locale;
    await updateUserLocale(ctx.db, ctx.currentUser.id, next);
    ctx.currentUser = { ...ctx.currentUser, locale: next };
    const nm = getMessages(next);
    await ctx.reply(next === 'ru' ? nm.bot.language.switchedToRu : nm.bot.language.switchedToEn);
  });
}
```

- [ ] **Step 4: Run typecheck + relevant tests**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/bot/help-menu.test.ts`
Expected: PASS — existing menu test still finds the help text.

- [ ] **Step 5: Commit**

```bash
git add src/server/bot/handlers/help.ts src/server/bot/handlers/info.ts src/server/bot/handlers/language.ts
git commit -m "refactor(bot): extract runHelp / runInfo / runLanguage"
```

---

## Task 5: Remove `/wallet`

**Files:**
- Delete: `src/server/bot/handlers/wallet.ts`
- Modify: `src/server/bot/index.ts`
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`

- [ ] **Step 1: Delete the handler**

Run: `rm src/server/bot/handlers/wallet.ts`

- [ ] **Step 2: Drop registration + command listing in `index.ts`**

In `src/server/bot/index.ts`:

Remove the import line:
```ts
import { registerWalletHandler } from './handlers/wallet';
```

Remove the call (currently around line 54):
```ts
    registerWalletHandler(_bot);
```

In `publicCommands(locale)`, remove the entry:
```ts
    { command: 'wallet', description: d.wallet },
```

- [ ] **Step 3: Drop the two bot-only wallet i18n keys (EN)**

In `src/shared/i18n/messages-en.ts`:

Remove the line in `cmdDescriptions`:
```ts
      wallet: 'Your subscription wallet',
```

Inside `wallet.bot`, remove these two lines (keep all surrounding keys — they are still used by the deposit/refund/pay conversations):
```ts
      walletHeading: (balance: string) => `💰 Subscription wallet: ${balance}`,
      walletEmpty: 'Your subscription wallet is empty.',
```

In the `helpText` template literal, drop the `/wallet` line if present (verify with `grep -n "/wallet" src/shared/i18n/messages-en.ts` first).

- [ ] **Step 4: Mirror the deletions in RU**

Same set of edits in `src/shared/i18n/messages-ru.ts`. Match by key name, not line number.

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors. If TS complains about a missing key, the key was still referenced somewhere — track down the caller and either re-add or remove the caller.

- [ ] **Step 6: Run full bot test suite**

Run: `pnpm vitest run tests/bot/`
Expected: all PASS. If a wallet test file exists, delete it (`rm tests/bot/wallet.test.ts` if applicable — verify with `ls tests/bot/`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(bot): remove /wallet command"
```

---

## Task 6: Rewrite `/menu` layout and wire real callbacks

**Files:**
- Modify: `src/server/bot/handlers/menu.ts`
- Modify: `src/shared/i18n/messages-en.ts`
- Modify: `src/shared/i18n/messages-ru.ts`
- Modify: `tests/bot/help-menu.test.ts`

- [ ] **Step 1: Add new menu i18n keys (EN)**

In `src/shared/i18n/messages-en.ts`, inside `bot: { ... }`, add immediately after `menuBtnTeamOverview`:

```ts
    menuBtnLanguage: '🌐 Language',
    menuBtnHelp: '❓ Help',
    menuBtnDeposit: '💳 Deposit',
    menuBtnGuestDeposit: '👥 Guest deposit',
```

Remove the now-unused lines:
```ts
    menuTypeHistory: 'Type /history to see your activity.',
    menuTypeInfo: 'Type /info to browse entries.',
```

- [ ] **Step 2: Mirror in RU**

In `src/shared/i18n/messages-ru.ts`, add at the matching location:

```ts
    menuBtnLanguage: '🌐 Язык',
    menuBtnHelp: '❓ Помощь',
    menuBtnDeposit: '💳 Депозит',
    menuBtnGuestDeposit: '👥 Гостевой депозит',
```

Remove `menuTypeHistory` and `menuTypeInfo` from RU as well.

- [ ] **Step 3: Update the menu test**

Replace `tests/bot/help-menu.test.ts`'s `describe('/help and /menu', ...)` body with:

```ts
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

  it('shows member menu with Balance, History, Info, Open mini app, Language, Help', async () => {
    await createUser(db, { telegramUserId: 5, displayName: 'M', role: 'member' });
    const { bot, replies } = setup(db);
    await bot.handleUpdate(helpUpdate(5, 'menu'));
    const out = replies.join('\n');
    expect(out).toMatch(/Main menu/i);
  });

  it('shows admin menu with admin-only buttons including Deposit and Guest deposit', async () => {
    await createUser(db, { telegramUserId: 7, displayName: 'A', role: 'admin' });
    // Capture the reply_markup to inspect buttons
    process.env.BOT_TOKEN = 'test:0123456789';
    process.env.BOT_USERNAME = 'test_bot';
    process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.SESSION_SECRET = 'a'.repeat(32);

    const buttonTexts: string[] = [];
    const bot = new Bot<BotContext>('123:abc', {
      botInfo: {
        id: 1, is_bot: true, first_name: 'TestBot', username: 'test_bot',
        can_join_groups: true, can_read_all_group_messages: false,
        supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
      },
    });
    bot.api.config.use((prev, method, payload) => {
      if (method === 'sendMessage') {
        const rm = (payload as { reply_markup?: { inline_keyboard?: { text: string }[][] } }).reply_markup;
        if (rm?.inline_keyboard) {
          for (const row of rm.inline_keyboard) for (const b of row) buttonTexts.push(b.text);
        }
        return Promise.resolve({
          ok: true,
          result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' },
        } as never);
      }
      return prev(method, payload);
    });
    bot.use((ctx, next) => { ctx.db = db; return next(); });
    bot.use(identifyUser);
    registerMenuHandler(bot);
    await bot.handleUpdate(helpUpdate(7, 'menu'));
    const joined = buttonTexts.join('|');
    expect(joined).toMatch(/Balance/);
    expect(joined).toMatch(/History/);
    expect(joined).toMatch(/Team overview/);
    expect(joined).toMatch(/Deposit/);
    expect(joined).toMatch(/Guest deposit/);
    expect(joined).toMatch(/Language/);
    expect(joined).toMatch(/Help/);
    // wallet is gone
    expect(joined).not.toMatch(/Wallet/);
  });
});
```

- [ ] **Step 4: Run tests to verify the new one fails**

Run: `pnpm vitest run tests/bot/help-menu.test.ts`
Expected: the admin-menu test FAILS — current menu lacks Deposit / Guest deposit / Language / Help buttons.

- [ ] **Step 5: Rewrite `menu.ts`**

Replace the entire contents of `src/server/bot/handlers/menu.ts`:

```ts
import { type Bot } from 'grammy';
import type { InlineKeyboardButton } from 'grammy/types';
import type { BotContext } from '../middleware';
import { env } from '@/server/env';
import { botMessages } from '../i18n';
import { runBalance } from './balance';
import { runHistory } from './history';
import { runInfo } from './info';
import { runHelp } from './help';
import { runLanguage } from './language';
import { renderTeamOverview } from './team';

export function registerMenuHandler(bot: Bot<BotContext>) {
  bot.command('menu', async (ctx) => {
    const { m } = botMessages(ctx);
    if (!ctx.currentUser) {
      await ctx.reply(m.bot.notMember);
      return;
    }
    const baseUrl = env().NEXT_PUBLIC_BASE_URL;
    const buttons: InlineKeyboardButton[][] = [
      [
        { text: m.bot.menuBtnBalance, callback_data: 'menu:balance' },
        { text: m.bot.menuBtnHistory, callback_data: 'menu:history' },
      ],
      [{ text: m.bot.menuBtnInfo, callback_data: 'menu:info' }],
      [{ text: m.bot.menuBtnOpenMini, web_app: { url: `${baseUrl}/mini` } }],
    ];
    if (ctx.currentUser.role === 'admin') {
      buttons.push(
        [{ text: m.bot.menuBtnTeamOverview, callback_data: 'menu:team' }],
        [
          { text: m.bot.menuBtnNewCharge, callback_data: 'menu:charge' },
          { text: m.bot.menuBtnRecordPayment, callback_data: 'menu:pay' },
        ],
        [
          { text: m.bot.menuBtnRecordSpending, callback_data: 'menu:spend' },
          { text: m.bot.menuBtnInvite, callback_data: 'menu:invite' },
        ],
        [
          { text: m.bot.menuBtnDeposit, callback_data: 'menu:deposit' },
          { text: m.bot.menuBtnGuestDeposit, callback_data: 'menu:guestdeposit' },
        ],
      );
    }
    buttons.push([
      { text: m.bot.menuBtnLanguage, callback_data: 'menu:language' },
      { text: m.bot.menuBtnHelp, callback_data: 'menu:help' },
    ]);
    await ctx.reply(m.bot.menuTitle(ctx.currentUser.displayName), {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.callbackQuery('menu:balance', async (ctx) => {
    await ctx.answerCallbackQuery();
    await runBalance(ctx);
  });
  bot.callbackQuery('menu:history', async (ctx) => {
    await ctx.answerCallbackQuery();
    await runHistory(ctx);
  });
  bot.callbackQuery('menu:info', async (ctx) => {
    await ctx.answerCallbackQuery();
    await runInfo(ctx);
  });
  bot.callbackQuery('menu:language', async (ctx) => {
    await ctx.answerCallbackQuery();
    await runLanguage(ctx);
  });
  bot.callbackQuery('menu:help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await runHelp(ctx);
  });

  bot.callbackQuery('menu:team', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.reply(await renderTeamOverview(ctx));
  });
  bot.callbackQuery('menu:charge', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('charge');
  });
  bot.callbackQuery('menu:pay', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('pay');
  });
  bot.callbackQuery('menu:spend', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('spend');
  });
  bot.callbackQuery('menu:invite', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    const { createInvite } = await import('@/server/domain/invites');
    const inv = await createInvite(ctx.db, { createdByUserId: ctx.currentUser.id });
    await ctx.reply(m.bot.inviteFromMenu(`https://t.me/${env().BOT_USERNAME}?start=invite_${inv.token}`));
  });
  bot.callbackQuery('menu:deposit', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('creditDeposit');
  });
  bot.callbackQuery('menu:guestdeposit', async (ctx) => {
    const { m } = botMessages(ctx);
    await ctx.answerCallbackQuery();
    if (ctx.currentUser?.role !== 'admin') { await ctx.reply(m.bot.adminsOnlyShort); return; }
    await ctx.conversation.enter('guestDeposit');
  });
}
```

- [ ] **Step 6: Run all bot tests + typecheck**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/bot/`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/bot/handlers/menu.ts src/shared/i18n/messages-en.ts src/shared/i18n/messages-ru.ts tests/bot/help-menu.test.ts
git commit -m "feat(bot): expanded menu layout + real callbacks"
```

---

## Task 7: Full validation

- [ ] **Step 1: Full typecheck**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 3: Final commit if anything outstanding**

If any test or lint fix was needed, commit it:

```bash
git add -A
git commit -m "chore: fix-ups from full validation"
```
