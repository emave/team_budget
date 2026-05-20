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

## Deployment

### Prerequisites

- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram numeric ID from [@userinfobot](https://t.me/userinfobot)
- A host with Docker installed and a public HTTPS URL (required for the Telegram Mini App and Telegram Login Widget — see [Spec §12](docs/superpowers/specs/2026-05-19-team-budget-design.md#121-https-requirements))
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
