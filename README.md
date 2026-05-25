# Team Budget

Self-hosted budget tracker for an airsoft team. Web UI + Telegram bot, single SQLite database.

## Status

Plan 1 (Foundation & Money Domain) — backend layer complete and tested. Web UI and bot conversational write flows arrive in Plan 2 and Plan 3.

## Dev setup

Requirements:
- Node 22 LTS
- pnpm 11+
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
5. Navigate to `/people`, click "+ Invite", generate a link.
6. Test settings: change dues amount, click "Generate dues now". Charges should appear on `/owed` for every active member.
7. Record a payment for one of those charges via `/received/new`. Confirm the dashboard pot balance updates.

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
4. Initialize the data directory:
   ```bash
   mkdir -p data
   ```
   (Migrations apply automatically on container start — no separate step needed.)
5. Push to `main` once so GitHub Actions publishes the first image, then make the GHCR package public:
   - Open `https://github.com/<your-user>/<your-repo>/packages` → `team-budget` → Package settings → Change visibility to **Public**.
   - This lets Watchtower on the host pull the image anonymously. (Alternative: keep it private and configure Watchtower with a registry credential — out of scope here.)

### Run (first time on the host)

```bash
docker compose pull
docker compose up -d
docker compose logs -f
```

The container's entrypoint applies database migrations against the `./data` volume on every start (idempotent — drizzle skips already-applied migrations), then starts the Next.js server.

Visit your HTTPS URL. On first `/start` to your bot in Telegram, you (the bootstrap admin) will be created.

### Subsequent deploys

Push to `main`. GitHub Actions builds and pushes a new image to `ghcr.io/emave/team-budget:latest`. Watchtower on the host polls GHCR (5-min default in this setup) and rolls the container automatically.

### Rolling back

To pin to a previous build, edit `docker-compose.yml` on the host:

```yaml
image: ghcr.io/emave/team-budget:sha-<full-commit-sha>
```

Then `docker compose up -d`. The sha tag is published for every main commit.

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
