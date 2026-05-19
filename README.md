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

## Smoke check

1. `pnpm dev`
2. As bootstrap admin: open `/`. You should be redirected to `/login` if no session.
3. Sign in with the Telegram widget.
4. Land on `/dashboard`. Verify pot balances render (both $0.00 on a fresh DB).
5. Navigate to `/members`, click "+ Invite", generate a link.
6. Test settings: change dues amount, click "Generate dues now". Charges should appear on `/charges` for every active member.
7. Record a payment for one of those charges via `/payments/new`. Confirm the dashboard pot balance updates.
