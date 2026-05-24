# Bot menu enhancement: single-balance model + completed callbacks

**Status:** Approved 2026-05-24
**Author:** siarhei.semikau@instinctools.com (with Claude)

## Problem

The Telegram bot's `/menu` command (`src/server/bot/handlers/menu.ts`)
has two related issues:

1. **Broken callbacks.** `menu:history` and `menu:info` reply with
   *"Type /history…"* / *"Type /info…"* placeholders instead of
   actually running those handlers. The user has to retype the
   command — defeating the menu's purpose.
2. **Missing entries.** Several existing commands aren't reachable
   from the menu: `/wallet`, `/language`, `/help`, and admin-only
   `/deposit` and `/guestdeposit`.

A second, larger issue surfaced while triaging the menu: the bot
exposes **two financial concepts** to end users — `/balance` (lists
open unpaid charges) and `/wallet` (shows credit balance + transaction
history). Members find this confusing. The intended mental model is
simpler: each member has **one signed balance** that goes up on
deposits / payments and down on charges / dues. The dual surface
should collapse to a single number plus a single chronological
history.

## Goals

- `/balance` returns one signed number per member (positive = money on
  account, negative = owed).
- `/history` becomes a unified ledger of every balance-affecting event
  (charges, payments, credit deposits, refunds, transfers).
- The menu's broken callbacks (`menu:history`, `menu:info`) actually
  run their handlers' logic.
- The menu exposes `/language`, `/help`, and admin `/deposit` /
  `/guestdeposit`.
- `/wallet` and its menu surface are removed; nothing in the UI hints
  at a separate "credit" concept.

## Non-goals

- No database / domain migration. The `credit` ledger and `charges`
  tables stay; the change is display-only. Net balance is computed as
  `credit_balance − outstanding_debt`.
- No new "monthly dues" subsystem — already covered by charges per
  `2026-05-22-manual-per-user-monthly-dues-design.md`.
- No section grouping, back-navigation, "close" button, or message
  editing for the menu. Each button still posts a new reply.
- No team-wide member-balance list (e.g. "Alice: 25, Bob: -10"). Each
  user sees only their own balance.
- No menu entries for `/refund` or `/info_edit` (admin power-user
  commands, stay command-only).
- No changes to the web dashboard or mini-app. Wallet concepts there
  are out of scope.

## Architecture

### Menu layout

**Member view** (everyone):
```
[💰 Balance]  [📜 History]
[ℹ️ Info]
[📱 Open mini app]
[🌐 Language] [❓ Help]
```

**Admin view** appends, between the mini-app row and the utility row:
```
[📊 Team overview]
[🔧 New charge]      [💵 Record payment]
[🛒 Record spending] [🔗 Invite]
[💳 Deposit]         [👥 Guest deposit]
```

Language + Help share the last row in both views.

### Net-balance helper

Add `getNetBalance(db, userId): Promise<number>` co-located with
`getCreditBalance` in `src/server/domain/credit.ts`. Implementation:

```ts
export async function getNetBalance(db: Db, userId: string): Promise<number> {
  const [credit, debt] = await Promise.all([
    getCreditBalance(db, userId),
    getMemberOutstandingDebt(db, userId),
  ]);
  return credit - debt;
}
```

`getMemberOutstandingDebt` lives in `src/server/domain/charges.ts`;
import it there.

### `/balance` rewrite

`src/server/bot/handlers/balance.ts` and the `menu:balance` callback
both call a shared `runBalance(ctx)` helper. The helper:

- Resolves `getNetBalance(ctx.db, ctx.currentUser.id)`.
- Replies with a single line. `formatCents` already prefixes `-` for
  negatives and emits `X.XX р.`; positives stay unprefixed. Examples:
  `Your balance: 10.00 р.`, `Your balance: -10.00 р.`,
  `Your balance: 0.00 р.`. New i18n key
  `m.bot.balanceLine(formattedAmount: string)` builds the line.

Drop the existing open-charge enumeration logic (`youOweTotal`,
`chargeBullet`, `listOpenChargesForMember` call) from this handler.
The same charges remain visible as debit lines in the unified
`/history`.

### `/history` expansion

`src/server/bot/handlers/history.ts` and `menu:history` both call a
shared `runHistory(ctx)` helper. The helper merges three sources into
one chronological list:

1. **Charges** issued to this member — debits (negative).
2. **Direct payments** by this member — credits (positive).
3. **Credit-ledger events** for this member (from
   `listCreditHistory`) — `payment_deposit`, `refund`,
   `transfer_in`, `transfer_out`. `payment_consumption` is **omitted**
   to avoid double-counting (the original charge already appears in
   #1).

Each entry renders as one line: `±amount  label  (date)`. Add new
i18n labels under `m.bot.historyEvent.*` covering the additional
event kinds; remove the now-unused `m.wallet.bot.*` and
`m.wallet.historyEvent.*` blocks.

Limit: 10 most recent events (unchanged).

### `/wallet` removal

Delete:

- `src/server/bot/handlers/wallet.ts`
- `registerWalletHandler` import + call in `src/server/bot/index.ts`
- `wallet` entry from `publicCommands` in `src/server/bot/index.ts`
- `m.bot.cmdDescriptions.wallet`
- `m.wallet.bot.*` (walletEmpty, walletHeading)
- `m.wallet.historyEvent.*` after their replacement labels are
  added under `m.bot.historyEvent.*`

`/deposit`, `/refund`, `/guestdeposit` conversations and the
underlying credit domain (`getCreditBalance`, `listCreditHistory`,
deposit/refund/transfer logic) remain — they still drive the
single-balance model under the hood.

### Helper extraction for `menu:*` callbacks

`menu:history`, `menu:info`, `menu:language`, `menu:help` today either
stub out or only exist as commands. Pattern: each handler file
exposes `runX(ctx: BotContext): Promise<void>` containing the body,
and `bot.command('x', ...)` becomes a one-liner that calls it. `menu.ts`
imports each `runX` for the matching callback.

For conversation entries (`menu:deposit`, `menu:guestdeposit`), no
helper is needed — match the existing `menu:charge` / `menu:pay` /
`menu:spend` pattern of calling `ctx.conversation.enter(...)`.

## Files touched

**Modified:**

- `src/server/bot/handlers/menu.ts` — new layout, real callbacks for
  history/info/language/help, new callbacks for deposit/guestdeposit.
  (There is no existing `menu:wallet` callback to remove — wallet was
  never wired into the menu.)
- `src/server/bot/handlers/balance.ts` — extract `runBalance`, swap
  body to net-balance line.
- `src/server/bot/handlers/history.ts` — extract `runHistory`, merge
  credit events.
- `src/server/bot/handlers/info.ts`, `language.ts`, `help.ts` —
  extract `runInfo` / `runLanguage` / `runHelp`.
- `src/server/bot/index.ts` — drop `registerWalletHandler`, drop
  `wallet` from `publicCommands`.
- `src/server/domain/credit.ts` — add `getNetBalance`.
- `src/shared/i18n/messages-en.ts`, `messages-ru.ts` — add
  `menuBtnLanguage`, `menuBtnHelp`, `menuBtnDeposit`,
  `menuBtnGuestDeposit`, `balanceLine`, expanded `historyEvent.*`
  labels. Remove `menuTypeHistory`, `menuTypeInfo`,
  `cmdDescriptions.wallet`, the open-charge bullet strings used by
  the old `/balance` (`youOweTotal`, `chargeBullet`, `settledYes`)
  if unused elsewhere, and all `wallet.bot.*` /
  `wallet.historyEvent.*` keys.

**Deleted:**

- `src/server/bot/handlers/wallet.ts`

**Tests modified or added:**

- `tests/bot/balance.test.ts` — assert single signed-number line for
  positive / negative / zero net balance.
- `tests/bot/history.test.ts` — assert deposits, refunds, and
  transfers now appear in unified history; assert
  `payment_consumption` does *not* appear (double-count guard).
- `tests/bot/help-menu.test.ts` — assert new button set for member +
  admin views; assert `menu:history` / `menu:info` produce real
  output rather than "Type /…" stubs; assert `menu:deposit` /
  `menu:guestdeposit` enter their conversations.

## Risks & mitigations

- **Stale Telegram command list.** `publicCommands` removal of
  `wallet` only takes effect after the next `publishAllCommands` run
  (called from `instrumentation.ts` boot). On TrueNAS, that happens
  on container restart — Watchtower's next image pull suffices. No
  manual step beyond the usual deploy.
- **Existing users with credit balance.** Display-only change; their
  balance still computes correctly via the helper. No data migration
  needed.
- **Double-counting in unified history.** Mitigated by explicitly
  excluding `payment_consumption` from the credit-event merge and
  asserting it in tests.

## Open questions

None — direction confirmed in brainstorming.
