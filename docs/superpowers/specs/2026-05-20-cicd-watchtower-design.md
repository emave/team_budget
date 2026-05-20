# CI/CD: GitHub Actions → GHCR → Watchtower

**Date:** 2026-05-20
**Status:** Approved for implementation
**Author:** brainstorming session

## Goal

On every push to `main`, ship a new build of team-budget to the TrueNAS host at 192.168.1.9 with zero manual steps, while keeping the home network sealed from inbound deploy traffic.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Registry | GHCR (`ghcr.io/emave/team-budget`) | Free, integrated with Actions, `GITHUB_TOKEN` is enough — no PATs to rotate. |
| Image visibility | Public | Simpler — Watchtower needs no auth. Source is already public; build artifact reveals nothing more. |
| Migrations | On container startup (entrypoint runs `migrate.mjs` before `server.js`) | True "push and forget"; SQLite single-writer means no race; failure is a fast crash, not corruption. |
| Deploy trigger | Watchtower polls GHCR on TrueNAS (already running) | No inbound SSH; CI pushes outward, Watchtower pulls outward. |
| CI gate | `check` (typecheck + lint + test) must pass before `build-and-push` runs | Broken main never reaches production. |
| Deploy scope | Only `push` events on `main`; PRs run checks only | Standard. Prevents fork PRs from triggering pushes. |

## Architecture

```
push to main on GitHub
        │
        ▼
GitHub Actions (.github/workflows/ci.yml)
  ├─ job: check          (typecheck + lint + test)
  └─ job: build-and-push (needs: check, main + push only)
        └─ docker buildx → push ghcr.io/emave/team-budget:{latest,sha-<full>}
        │
        ▼  (public registry, no auth)
Watchtower on TrueNAS (already running, one instance for all containers on host)
   polls GHCR every 5 min → detects new digest → pulls + restarts container
        │
        ▼
team-budget container
   docker-entrypoint.sh:
     node scripts/migrate.mjs   # drizzle migrations against /data/team_budget.db
     exec node server.js        # Next.js standalone
```

## Components

### 1. `.github/workflows/ci.yml` — replace existing

Two jobs. `check` is the existing CI logic, bumped to align with the Dockerfile (Node 22, pnpm 11). `build-and-push` is new, gated on `check`, scoped to push-on-main.

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
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

  build-and-push:
    needs: check
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/emave/team-budget
          tags: |
            type=raw,value=latest
            type=sha,format=long
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Notes:
- `GITHUB_TOKEN` is auto-issued per workflow run; scoped to this repo's packages only.
- `cache-from/to: type=gha` reuses GitHub Actions cache for buildx layers — keeps deploys fast (~1 min after first build).
- `:latest` floats; `sha-<full>` gives an immutable history for rollback.
- The `if:` guard prevents fork PRs from triggering pushes — they don't get write tokens anyway, but defense in depth.

### 2. `scripts/migrate.mjs` — new file

Pure ESM so it runs under plain `node` (no `tsx` in the runtime image). Functionally identical to the existing `scripts/migrate.ts`, which stays for local `pnpm db:migrate`.

```js
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
migrate(drizzle(sqlite), { migrationsFolder: 'drizzle' });
console.log('Migrations applied to', url);
sqlite.close();
```

### 3. `docker-entrypoint.sh` — new file

```sh
#!/bin/sh
set -e
node scripts/migrate.mjs
exec node server.js
```

`exec` so Node becomes PID 1 and gets signals from Docker cleanly.

### 4. `Dockerfile` — additions in runner stage

The migrator submodule (`drizzle-orm/better-sqlite3/migrator`) is not on the Next app's import graph, so Next standalone's tracer may omit it. Copy the full packages explicitly to be safe. `better-sqlite3` is copied alongside for the same reason and to guarantee the alpine-built native binding matches.

Runner stage gains, after the existing COPYs:

```dockerfile
COPY --from=deps  /app/node_modules/drizzle-orm     ./node_modules/drizzle-orm
COPY --from=deps  /app/node_modules/better-sqlite3  ./node_modules/better-sqlite3
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN  chmod +x docker-entrypoint.sh
```

And `CMD` changes from `["node", "server.js"]` to `["./docker-entrypoint.sh"]`.

### 5. `docker-compose.yml` — switch from local build to GHCR image

Drop `build: .`, point `image:` at GHCR, add the Watchtower opt-in label.

```yaml
services:
  team-budget:
    image: ghcr.io/emave/team-budget:latest
    container_name: team-budget
    restart: unless-stopped
    ports: ["3000:3000"]
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
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
```

`command:` is removed — the image's `CMD` (entrypoint) takes over. The `./data` volume is untouched, preserving the SQLite DB across the cutover.

### 6. Watchtower configuration (one-time on TrueNAS)

Inspect the existing instance:

```sh
ssh root@192.168.1.9 'docker inspect watchtower --format "{{json .Args}} {{json .Config.Env}}"'
```

Two settings matter:

- **Polling interval.** Default is 86400s (24h). Set `WATCHTOWER_POLL_INTERVAL=300` (5 min) so deploys land promptly. If absent, recreate the watchtower container with the env var.
- **Label scope.** If `WATCHTOWER_LABEL_ENABLE=true` or `--label-enable` is set, only containers carrying `com.centurylinklabs.watchtower.enable=true` get updated. Our compose adds that label, so we're opt-in in either mode.

Recommended additional setting: `WATCHTOWER_CLEANUP=true` so old image layers are pruned after each update. Otherwise GHCR layers accumulate on the boot pool over time.

### 7. `README.md` — update Deployment section

Replace the manual "git pull; docker compose up -d --build" workflow with:

```
Initial setup (one-time):
  scp docker-compose.yml truenas:/path/to/team_budget/
  ssh truenas 'cd /path/to/team_budget && docker compose pull && docker compose up -d'

Subsequent deploys: just push to main. Watchtower handles the rest.

To roll back: edit docker-compose.yml on TrueNAS, pin
  image: ghcr.io/emave/team-budget:sha-<full-commit-sha>
then docker compose up -d.
```

## Cutover sequence (one-time, manual)

1. Land all repo changes on `main`. CI builds, pushes `ghcr.io/emave/team-budget:latest` for the first time.
2. Make the GHCR package public via GitHub UI → Packages → team-budget → Settings → Change visibility (GHCR packages default to private even when the repo is public).
3. On TrueNAS: copy the updated `docker-compose.yml` over the existing one.
4. `docker compose pull` — fetches the first registry image.
5. `docker compose up -d` — recreates the container using the pulled image. Entrypoint runs migrations against the existing `./data/team_budget.db`. App comes up.
6. Tune Watchtower per §6 above if needed.

After this, the manual `docker save | ssh load` workflow is retired.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Migration breaks → container crash-loops | Low (caught locally before push) | SQLite migrations are transactional, data intact. Roll back by pinning compose to the previous `sha-<…>` tag. |
| Watchtower polls only once per day | Certain on defaults | Set `WATCHTOWER_POLL_INTERVAL=300`. |
| GHCR layer bloat on TrueNAS disk | Likely over months | Set `WATCHTOWER_CLEANUP=true`. |
| Fork PR triggers a push to GHCR | None | `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` blocks it; `GITHUB_TOKEN` on PRs from forks is read-only anyway. |
| First image after cutover has no semantic-version tag, only `:latest` + `sha-<…>` | By design | Rollback uses the sha tag; `:latest` is fine for forward motion. Semver tagging can be added later if releases ever need it. |
| Next standalone tracer omits drizzle migrator package | Possible | Explicit `COPY` of full `drizzle-orm` and `better-sqlite3` packages in the runner stage (§4). |

## Out of scope

- Cosign signing / SLSA provenance — overkill for a single-tenant personal app.
- Trivy / image vuln scanning — useful, but additive; add later as a `check` step if desired.
- PR preview deploys — single-instance app, no separate preview env.
- Multi-arch builds — TrueNAS Scale is amd64, so single-arch is correct.
- Watchtower notifications (Slack/email) — additive; the GHCR Actions log + manual `docker logs team-budget` cover failure visibility.

## Files touched (manifest)

| File | Action |
|---|---|
| `.github/workflows/ci.yml` | Modify — split jobs, add build-and-push |
| `scripts/migrate.mjs` | Create — ESM port of migrate.ts |
| `docker-entrypoint.sh` | Create — runs migrations then server |
| `Dockerfile` | Modify — copy deps + entrypoint into runner, change CMD |
| `docker-compose.yml` | Modify — switch to GHCR image, add Watchtower label, remove `build:` and `command:` |
| `README.md` | Modify — update Deployment section |
