# Team Budget — Design Spec

**Date:** 2026-05-19
**Status:** Approved for implementation planning
**Scope:** v1 of a self-hosted, single-team airsoft budget tool with web UI and Telegram bot

---

## 1. Purpose

A small self-hosted application for tracking an airsoft team's shared money. It collects fixed monthly dues from members, records team spendings out of two pots (cash + card), supports ad-hoc shared expenses split across members (e.g., a group equipment purchase), tracks per-member debts, and exposes everything through both a web UI and a Telegram bot.

It is built for **one team**. No multi-tenancy, no sign-up flow for external teams.

## 2. Users and Roles

Two roles only:

- **Admin** — full read/write. Manages members, creates charges and spendings, records payments, edits info pages, changes settings.
- **Member** — read-only. Sees their own debts and history, the team's pot balances, the member roster, and the info pages.

Members authenticate via Telegram (no passwords). The web UI uses Telegram Login Widget; the bot reads `ctx.from.id` directly. Identity equals Telegram user id.

A single bootstrap admin is seeded from `BOOTSTRAP_ADMIN_TELEGRAM_ID` on the first `/start` from that ID. Subsequent members join via admin-issued invite links.

## 3. Money Model

### 3.1 Two pots

The team has two distinct holdings:

- **Cash pot** — physical cash held by the admin/treasurer
- **Card pot** — money on a team bank card or transfer account

Each pot's balance is **derived** from the immutable record of payments, spendings, and pot-borrow events. There is no stored pot balance to drift out of sync.

### 3.2 Monthly dues

- One global setting: `monthly_dues_amount`. Single currency (configurable, default USD).
- Each member pays one fee per month. The payment **method** (cash vs. card) is the member's choice when paying.
- On the first day of each calendar month, the system auto-generates one `monthly_dues` charge per active member at the current `monthly_dues_amount`.
- Changing the dues amount affects future months only — existing charges retain their original amount.
- New members joining mid-month start being charged from the next billing period (no proration in v1).

### 3.3 Out-of-bounds (split) spending

Used when a purchase should be charged directly to members rather than coming out of the team pots.

- Admin specifies a description and selects participating members.
- Admin enters a per-member amount. The UI defaults to an equal split (total ÷ N) but each per-member amount can be overridden.
- The system creates N `out_of_bounds` charges, one per selected member, sharing a single `group_id` so the UI can render the group as one event.

### 3.4 Pot borrow

When a member takes cash (or makes a personal transfer) from a team pot:

- Admin records: member, amount, source pot, description.
- Pot balance decreases immediately (the money physically left).
- A `pot_borrow` charge is created against the member with `source_pot` recorded for reference.
- Repayment is a regular `Payment` allocated to that charge. The repayment's method may differ from the source pot (e.g., borrowed cash, repaid by card) — that's expected and the pot ledger reflects it correctly.

### 3.5 Ad-hoc charges

Admin can create a single `adhoc` charge against one member for any reason, with a free-text description.

### 3.6 Payments

- Recorded by admin with payer, method, amount, optional note.
- A payment **must fully allocate** to one or more of the payer's open charges via `payment_allocations`. No floating credit in v1.
- The UI defaults allocations to FIFO (oldest charges first); admin can rebalance manually before confirming.
- Payment amount cannot exceed the member's total outstanding debt.

### 3.7 Spendings (out of pot)

Recorded by admin when the team buys something using its own money: pot, amount, optional category, description, occurred_at. Decrements the chosen pot. Does not create any charge.

### 3.8 Cancellations

Charges and payments both have a `cancelled` status (no hard deletes):

- Cancelling a payment removes its allocations; previously-paid charges may reopen.
- Cancelling a charge is forbidden while it has allocations — admin must reverse the relevant payments first.

### 3.9 Derived values

- **Cash pot** = Σ(cash payments) − Σ(cash spendings) − Σ(pot_borrow charges where `source_pot = cash`)
- **Card pot** = Σ(card payments) − Σ(card spendings) − Σ(card pot_borrows)
- **Member outstanding debt** = Σ for member's open charges of `(charge.amount − Σ allocations.amount for that charge)`
- **Charge status** = `paid` when `Σ allocations.amount >= amount`, else `open` (unless explicitly `cancelled`)

## 4. Data Model

All tables. Money stored as integers in minor units (cents) to avoid floating-point error. Currency is a single global setting; no per-row currency.

### 4.1 `users`

| Column              | Type        | Notes                                  |
| ------------------- | ----------- | -------------------------------------- |
| `id`                | uuid pk     |                                        |
| `telegram_user_id`  | int64 unique|                                        |
| `telegram_username` | text null   | may change over time                   |
| `display_name`      | text        |                                        |
| `photo_url`         | text null   | from Telegram login                    |
| `role`              | enum        | `admin` \| `member`                    |
| `is_active`         | bool        | inactive users stop receiving dues     |
| `created_at`        | timestamp   |                                        |
| `deactivated_at`    | timestamp null |                                     |

### 4.2 `invites`

| Column                 | Type      | Notes                                 |
| ---------------------- | --------- | ------------------------------------- |
| `id`                   | uuid pk   |                                       |
| `token`                | text unique | url-safe                            |
| `created_by_user_id`   | fk users  |                                       |
| `display_name_hint`    | text null | optional admin-provided hint          |
| `consumed_by_user_id`  | fk users null |                                   |
| `created_at`           | timestamp |                                       |
| `consumed_at`          | timestamp null |                                  |

### 4.3 `settings`

Single-row table:

| Column                     | Type        | Notes                              |
| -------------------------- | ----------- | ---------------------------------- |
| `monthly_dues_amount`      | int (cents) |                                    |
| `currency`                 | text        | ISO 4217 code                      |
| `due_day`                  | int         | default 1                          |
| `last_dues_generated_for`  | text null   | `YYYY-MM`, idempotency marker      |

### 4.4 `categories`

| Column     | Type    | Notes                            |
| ---------- | ------- | -------------------------------- |
| `id`       | uuid pk |                                  |
| `name`     | text    |                                  |
| `archived` | bool    | hide from new entries, keep history |

### 4.5 `charges`

| Column                | Type      | Notes                                                  |
| --------------------- | --------- | ------------------------------------------------------ |
| `id`                  | uuid pk   |                                                        |
| `user_id`             | fk users  |                                                        |
| `type`                | enum      | `monthly_dues` \| `out_of_bounds` \| `adhoc` \| `pot_borrow` |
| `amount`              | int (cents) |                                                      |
| `description`         | text      |                                                        |
| `billing_period`      | text null | `YYYY-MM`, only for `monthly_dues`                     |
| `group_id`            | uuid null | set for `out_of_bounds` to group split rows            |
| `source_pot`          | enum null | `cash` \| `card`, only for `pot_borrow`                |
| `status`              | enum      | `open` \| `paid` \| `cancelled`; computed on every write |
| `created_at`          | timestamp |                                                        |
| `created_by_user_id`  | fk users  |                                                        |

### 4.6 `payments`

| Column                | Type      | Notes                          |
| --------------------- | --------- | ------------------------------ |
| `id`                  | uuid pk   |                                |
| `payer_user_id`       | fk users  |                                |
| `method`              | enum      | `cash` \| `card`               |
| `amount`              | int (cents) |                              |
| `note`                | text null |                                |
| `received_at`         | timestamp |                                |
| `cancelled_at`        | timestamp null |                           |
| `created_at`          | timestamp |                                |
| `created_by_user_id`  | fk users  |                                |

### 4.7 `payment_allocations`

| Column        | Type        | Notes                       |
| ------------- | ----------- | --------------------------- |
| `id`          | uuid pk     |                             |
| `payment_id`  | fk payments |                             |
| `charge_id`   | fk charges  |                             |
| `amount`      | int (cents) |                             |

Invariants enforced in domain code:
- Σ(`allocations.amount` for a payment) = `payment.amount`
- Σ(`allocations.amount` for a charge) ≤ `charge.amount`

### 4.8 `spendings`

| Column                | Type      | Notes                                    |
| --------------------- | --------- | ---------------------------------------- |
| `id`                  | uuid pk   |                                          |
| `pot`                 | enum      | `cash` \| `card`                         |
| `amount`              | int (cents) |                                        |
| `category_id`         | fk categories null |                                  |
| `description`         | text      |                                          |
| `occurred_at`         | timestamp |                                          |
| `created_at`          | timestamp |                                          |
| `created_by_user_id`  | fk users  |                                          |

### 4.9 `info_pages`

| Column                | Type      | Notes                            |
| --------------------- | --------- | -------------------------------- |
| `id`                  | uuid pk   |                                  |
| `title`               | text      |                                  |
| `body`                | text      | markdown                         |
| `sort_order`          | int       |                                  |
| `created_at`          | timestamp |                                  |
| `updated_at`          | timestamp |                                  |
| `updated_by_user_id`  | fk users  |                                  |

### 4.10 `sessions`

| Column        | Type      | Notes                                |
| ------------- | --------- | ------------------------------------ |
| `token`       | text pk   | opaque, 256-bit random               |
| `user_id`     | fk users  |                                      |
| `expires_at`  | timestamp | 30-day sliding window                |
| `created_at`  | timestamp |                                      |

## 5. Architecture

### 5.1 Topology

One Next.js (App Router) application, deployed as a single Docker container.

- Web UI (Server Components + targeted client components, Base Web/Styletron)
- Telegram bot (grammY) runs in the same Node process, started on app boot, using **long-polling**. Polling chosen for self-host friendliness — no need for public HTTPS or a domain.
- Background scheduler (`node-cron`) runs in-process for monthly dues generation.
- Persistence: SQLite via Drizzle ORM, single file at `data/team_budget.db`, WAL mode for concurrent reads.

### 5.2 Boot sequence

A single `src/server/boot.ts` module is initialized on first request:

1. Open the SQLite connection (Drizzle).
2. Apply pending migrations.
3. Seed defaults (settings, single bootstrap admin if env var matches).
4. Start the grammY bot (long-polling).
5. Start the cron scheduler.

The bot and scheduler share the same database connection pool and call into the same domain functions as the web UI.

### 5.3 Domain layer

`src/server/domain/` holds pure functions that accept a Drizzle transaction handle and validated input, and produce side effects on the database plus return data. All money mutations wrap their reads + writes in a single SQLite transaction. The web routes, server actions, and bot handlers are thin shells — they validate input with zod and delegate to a domain function.

This layout is what keeps the system testable and lets the bot and web reuse the same logic without duplication.

### 5.4 Concurrency

SQLite in WAL mode permits one writer at a time. Writes are short and transactional; no long-running write transactions. Reads do not block writers.

## 6. Auth & Onboarding

### 6.1 Web sign-in (Telegram Login Widget)

1. Login page shows Telegram's official Login Widget (configured with `BOT_USERNAME`).
2. User authorizes; widget posts a signed payload to `/api/auth/telegram/callback`.
3. Server verifies the HMAC-SHA256 signature using `BOT_TOKEN` (per Telegram's [docs](https://core.telegram.org/widgets/login#checking-authorization)).
4. Server looks up `users.telegram_user_id`. If found, create a `sessions` row, set an httpOnly signed cookie, redirect to dashboard. If not found, reject with "ask admin for an invite."
5. Sessions are 30 days, sliding-refreshed on each authenticated request.

### 6.2 Bot recognition

Every bot update is matched on `ctx.from.id`. Unknown users get one of two responses:

- If the update is `/start invite_<token>` and the token is valid: consume the invite, create the `users` row, role `member`, send welcome message.
- Otherwise: "you're not a team member yet — ask admin for an invite link."

### 6.3 Bootstrap admin

`BOOTSTRAP_ADMIN_TELEGRAM_ID` env var holds the initial admin's Telegram numeric ID. On the bot's first `/start` from that ID with no matching `users` row, the row is created with role `admin`. Subsequent unknown `/start`s do not auto-create admins.

### 6.4 Invites

Admin opens "Invite member" in the web UI, optionally enters a name hint, clicks Generate. System creates an `invites` row and shows a deep link: `https://t.me/{BOT_USERNAME}?start=invite_<token>`. Admin shares it via Telegram. Tokens are single-use, no expiry in v1.

### 6.5 Deactivation

Admin marks a member inactive in the UI. Effect: no more monthly dues generated for them. Existing charges, payments, and history remain visible. Can be reactivated.

## 7. Bot UX

### 7.1 Pattern

Commands are entry points; everything else is inline keyboards. Numeric inputs (amounts) come via prompted messages — no free-text parsing of complex commands. Multi-step flows use grammY conversations for state.

### 7.2 Commands

Everyone:
- `/start` — registration entry; handles invite tokens; shows main menu
- `/balance` — your outstanding debts + total
- `/history` — your last 10 charges and payments
- `/info` — opens FAQ list (inline keyboard with titles)
- `/help` — quick command list
- `/menu` — re-summons the main inline-keyboard menu

Admin only:
- `/admin` — admin inline menu
- `/spend` — record a spending (pot, amount, category, desc)
- `/pay` — record a payment (member, method, amount, allocations)
- `/charge` — create a charge (single member / split / pot borrow)
- `/invite` — generate an invite link
- `/info_edit` — manage FAQ entries

### 7.3 Notifications

Three event types push DMs from the bot:

- **New charge** for member → "You have a new charge: <desc> $X. /balance to see total."
- **Payment recorded** for member → "Payment $X received. Remaining: $Y."
- **Monthly dues generated** → DM to every active member: "Monthly dues for <Month> have been added. You owe $Y total."

No noisy notifications beyond these. All DMs go to the affected user only.

### 7.4 Mini App entry

The `/menu` reply includes a "📱 Open mini app" Telegram Web App button that launches the `/mini` route inside Telegram. Useful for browsing long history, viewing per-member breakdowns, and editing info pages from the phone.

## 8. Web UI

### 8.1 Tech

- **Base Web** (`baseui`) component library, Styletron for styling
- `react-hook-form` + `zod` for forms (schemas shared client/server)
- TanStack Query for any client-side data fetching
- Phosphor Icons
- Light/dark theme switcher; mini app derives theme from Telegram `themeParams`

### 8.2 Pages

| Page         | Audience       | Purpose                                                                             |
| ------------ | -------------- | ----------------------------------------------------------------------------------- |
| `/dashboard` | admin & member | Two pot balances (admin)/personal balance (member), recent activity, quick actions  |
| `/members`   | admin & member | Roster + per-member debt; admin: invite, role, deactivate                            |
| `/charges`   | admin & member | Filterable ledger; admin: create, cancel                                             |
| `/payments`  | admin & member | Filterable ledger; admin: record, cancel                                             |
| `/spendings` | admin & member | Filterable ledger grouped by category; admin: record                                 |
| `/info`      | admin & member | FAQ list; admin: edit, reorder, add, archive                                         |
| `/settings`  | admin only     | Dues amount, currency, due day, category list                                        |
| `/mini/*`    | both           | Telegram Mini App routes (same components, narrow viewport, Telegram-theme tokens)  |

### 8.3 Layout

- Top `HeaderNavigation` on web with tab links to the pages above
- Bottom tab bar on the mini app for the most-used pages (Dashboard, Charges, Payments, Info)

## 9. Scheduled Jobs

A single in-process `node-cron` job:

- **Monthly dues generation** — runs daily at `00:05` server time. If `settings.due_day` has passed for the current `YYYY-MM` and `settings.last_dues_generated_for` is not the current period, create one `monthly_dues` charge per active member at the current `monthly_dues_amount`, then update `last_dues_generated_for`. Idempotent.

Admin can trigger this manually from the Settings page in case the server was down during the scheduled run.

## 10. Project Structure

```
team_budget/
├── docs/superpowers/specs/        # design + plan docs
├── data/                          # SQLite file (gitignored)
├── drizzle/                       # generated migrations
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (admin)/               # admin-only routes
│   │   │   ├── dashboard/
│   │   │   ├── members/
│   │   │   ├── charges/
│   │   │   ├── payments/
│   │   │   ├── spendings/
│   │   │   ├── info/
│   │   │   └── settings/
│   │   ├── (member)/              # member-readable routes
│   │   ├── mini/                  # Telegram Mini App routes
│   │   ├── api/auth/telegram/     # login widget callback
│   │   ├── login/
│   │   └── layout.tsx             # Styletron + Base Web providers
│   ├── server/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle table definitions
│   │   │   └── client.ts
│   │   ├── domain/                # pure business logic
│   │   │   ├── charges.ts
│   │   │   ├── payments.ts
│   │   │   ├── spendings.ts
│   │   │   ├── pots.ts
│   │   │   ├── dues.ts
│   │   │   ├── members.ts
│   │   │   ├── invites.ts
│   │   │   └── info-pages.ts
│   │   ├── auth/                  # Telegram widget verification, sessions
│   │   ├── bot/
│   │   │   ├── index.ts           # grammY setup + polling
│   │   │   ├── middleware.ts      # auth, role checks
│   │   │   ├── handlers/          # one file per flow
│   │   │   └── notifications.ts
│   │   ├── jobs/
│   │   │   └── monthly-dues.ts
│   │   └── boot.ts                # entry: starts bot + cron on app boot
│   ├── ui/
│   │   ├── theme.ts               # LightTheme/DarkTheme + telegram adapter
│   │   ├── primitives/
│   │   └── forms/
│   └── shared/
│       └── schemas.ts             # zod schemas shared client/server
├── tests/
│   ├── domain/                    # vitest unit tests
│   ├── integration/               # db + domain + light bot
│   └── e2e/                       # playwright smoke
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

## 11. Testing Strategy

Heavy on domain unit tests, moderate integration, very thin e2e.

### 11.1 Domain unit tests (Vitest)

Run against in-memory SQLite, each test in a fresh schema or transaction. Cover the money math:

- Pot balance is correct after every combination of payment/spending/pot_borrow events
- Charge status transitions: `open → paid` when fully allocated; reopens to `open` when allocations are removed
- Allocation invariants: payment fully allocated; charge never overdrawn
- Monthly dues generation is idempotent across reruns and skips inactive members
- Split charges share a `group_id` and bind only the selected members
- Pot borrow decrements pot at creation; repayment via either method increases the chosen pot correctly
- Cancelling a payment cascades and reopens previously-paid charges
- Cancelling an allocated charge is rejected
- Telegram widget signature verification rejects tampered payloads

### 11.2 Integration tests (Vitest)

Full request → domain → db flow for critical paths. Server actions for charges/payments/spendings; a few bot handlers using grammY's test utilities.

### 11.3 E2E smoke (Playwright)

Login → dashboard → record a payment → balance updates. No bot e2e.

### 11.4 Validation

Every zod schema gets one positive + one negative test.

## 12. Deployment

- Single Docker image, single container.
- Mounts a host volume for `data/` (SQLite database) so it survives container restarts.
- Env vars: `BOT_TOKEN`, `BOT_USERNAME`, `BOOTSTRAP_ADMIN_TELEGRAM_ID`, `NEXT_PUBLIC_BASE_URL`, `CURRENCY`.
- `docker-compose.yml` provides the dev setup with the volume already configured.
- No external dependencies (no Redis, no Postgres, no SMTP). Bot uses polling, so no public HTTPS required.

## 13. Out of Scope for v1

Items explicitly deferred:

- Multi-team / multi-tenancy
- Multi-currency or FX
- Mid-month proration when a member joins
- Floating credit / overpayments (every payment fully allocates)
- Hard deletes — only `cancelled` status
- Audit log of admin actions
- Events bundling (e.g., "Game day 2026-06-12 had these expenses")
- CSV / PDF export
- Email or SMS notifications (Telegram only)
- Bank API integration
- Reminder engine for unpaid debts (beyond the three notification rules)
- Webhook-based bot (long-polling for v1)
- Two-process / multi-container deploy
