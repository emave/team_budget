# CI/CD: Actions → GHCR → Watchtower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every push to `main`, ship a new build of team-budget to the TrueNAS host with zero manual steps, via GitHub Actions → GHCR → Watchtower.

**Architecture:** CI runs typecheck/lint/test, then builds and pushes a Docker image to a public GHCR repo. Watchtower (already running on TrueNAS) polls GHCR every 5 minutes, pulls new digests, and recreates the container. Drizzle migrations run from a startup entrypoint inside the container — no manual SQL piping per deploy.

**Tech Stack:** GitHub Actions (`docker/build-push-action@v6`), GHCR (public), Watchtower, Docker Compose, Node 22 Alpine, pnpm 11, Next.js standalone, drizzle-orm + better-sqlite3.

**Spec:** [docs/superpowers/specs/2026-05-20-cicd-watchtower-design.md](../specs/2026-05-20-cicd-watchtower-design.md)

---

## Task 1: Add `scripts/migrate.mjs` and verify locally

The runtime image strips `tsx`, so `scripts/migrate.ts` can't run there. We add a pure-ESM sibling that uses only packages already in production deps (`drizzle-orm`, `better-sqlite3`).

**Files:**
- Create: `scripts/migrate.mjs`

- [ ] **Step 1: Create `scripts/migrate.mjs`**

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

- [ ] **Step 2: Run against a throwaway DB**

Run from repo root:
```bash
rm -f /tmp/test-migrate.db && DATABASE_URL=/tmp/test-migrate.db node scripts/migrate.mjs
```

Expected stdout: `Migrations applied to /tmp/test-migrate.db`
Expected exit code: 0

- [ ] **Step 3: Verify drizzle tables were created**

```bash
sqlite3 /tmp/test-migrate.db ".tables"
```

Expected output contains: `__drizzle_migrations  categories  charges  info_pages  invites  payment_allocations` (among others). The `__drizzle_migrations` table is the proof the migrator ran.

- [ ] **Step 4: Cleanup**

```bash
rm -f /tmp/test-migrate.db
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.mjs
git commit -m "build: add migrate.mjs for runtime migrations

Pure-ESM sibling of scripts/migrate.ts that runs under plain node, so
the runtime container doesn't need tsx. Used by the upcoming
docker-entrypoint to apply migrations on container start."
```

---

## Task 2: Add entrypoint and update Dockerfile

The entrypoint runs migrations then `exec`s the Next.js server. The Dockerfile changes copy two packages into the runner so the migrator path resolves (Next standalone's NFT tracer may omit `drizzle-orm/better-sqlite3/migrator` because the app's import graph never reaches it).

**Files:**
- Create: `docker-entrypoint.sh`
- Modify: `Dockerfile` (runner stage)

- [ ] **Step 1: Create `docker-entrypoint.sh`**

```sh
#!/bin/sh
set -e
node scripts/migrate.mjs
exec node server.js
```

`exec` so Node becomes PID 1 and receives Docker's stop signal directly.

- [ ] **Step 2: Make it executable in the repo**

```bash
chmod +x docker-entrypoint.sh
```

(The Dockerfile also chmods it inside the image — both layers help: this one keeps it executable for anyone running it locally.)

- [ ] **Step 3: Modify the Dockerfile runner stage**

The current runner stage looks like this — note where each new line goes. Replace the runner stage block in `Dockerfile` with this exact content:

```dockerfile
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
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["./docker-entrypoint.sh"]
```

Changes from the current file:
- Added 4 lines (two `COPY --from=deps`, one `COPY` for entrypoint, one `RUN chmod`).
- Changed `CMD` from `["node", "server.js"]` to `["./docker-entrypoint.sh"]`.

- [ ] **Step 4: Commit**

```bash
git add docker-entrypoint.sh Dockerfile
git commit -m "build: run migrations on container start

Adds docker-entrypoint.sh that invokes scripts/migrate.mjs before
exec'ing node server.js. Copies drizzle-orm + better-sqlite3 into the
runner stage explicitly so the migrator path resolves under Next
standalone's pruned node_modules."
```

---

## Task 3: Build and verify the container locally

The entrypoint must apply migrations on first boot and start the server. Verify before we commit to the CI workflow.

**No file changes — verification only.**

- [ ] **Step 1: Build the image**

```bash
docker build -t team-budget:local .
```

Expected: completes without error, ~2–4 min on cold cache.

- [ ] **Step 2: Run the container against a fresh data dir**

```bash
rm -rf /tmp/tb-test && mkdir -p /tmp/tb-test
docker run --rm -d --name tb-test \
  -p 13000:3000 \
  -v /tmp/tb-test:/data \
  -e BOT_TOKEN=000000:dummy \
  -e BOT_USERNAME=dummybot \
  -e BOOTSTRAP_ADMIN_TELEGRAM_ID=1 \
  -e NEXT_PUBLIC_BASE_URL=http://localhost:13000 \
  -e SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  -e SKIP_BOT=1 \
  -e SKIP_CRON=1 \
  team-budget:local
```

- [ ] **Step 3: Verify migration log line**

```bash
sleep 3 && docker logs tb-test 2>&1 | grep -E "Migrations applied"
```

Expected output (one line): `Migrations applied to /data/team_budget.db`

- [ ] **Step 4: Verify the DB file was created with drizzle tables**

```bash
sqlite3 /tmp/tb-test/team_budget.db ".tables"
```

Expected output contains: `__drizzle_migrations categories charges` etc. (same as Task 1 Step 3).

- [ ] **Step 5: Verify the Next.js server responds**

```bash
sleep 2 && curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:13000/login
```

Expected: `200`

- [ ] **Step 6: Cleanup**

```bash
docker stop tb-test || true
rm -rf /tmp/tb-test
docker image rm team-budget:local || true
```

- [ ] **Step 7: Commit only if anything changed**

Nothing should have changed in the repo from this task. If it did (e.g., autoformatter), inspect and discard or amend Task 2 as appropriate.

---

## Task 4: Add the build-and-push CI job

Replace `.github/workflows/ci.yml` so checks gate a docker buildx push to GHCR on push-to-main.

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the workflow file**

Overwrite `.github/workflows/ci.yml` with exactly this content:

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
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
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

Changes vs. existing file:
- `check` job: pnpm bumped 9 → 11, Node bumped 20 → 22 (match Dockerfile).
- `build-and-push` job: new.

- [ ] **Step 2: Validate YAML**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK
```

Expected output: `OK`

- [ ] **Step 3: (Optional) Run actionlint via docker**

```bash
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color
```

Expected: no output (exit 0). If actionlint isn't available, skip this step.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build and push image to ghcr on main

Splits ci.yml into check (typecheck+lint+test) and build-and-push
(docker buildx → ghcr.io/emave/team-budget:{latest,sha-<full>}).
build-and-push is gated on check and only runs on push to main, so
PRs (including from forks) cannot push images.

Aligns runner Node/pnpm with the Dockerfile (22 / 11)."
```

---

## Task 5: Switch `docker-compose.yml` to GHCR image

The compose file ships in the repo and is deployed verbatim to TrueNAS. Drop the local `build:`, point `image:` at GHCR, add the Watchtower opt-in label.

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace `docker-compose.yml`**

Overwrite with exactly:

```yaml
services:
  team-budget:
    image: ghcr.io/emave/team-budget:latest
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
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
```

Removed: `build: .` and `command: ["node", "server.js"]`. The image's `CMD` (docker-entrypoint.sh) handles startup.

- [ ] **Step 2: Validate compose syntax**

```bash
docker compose -f docker-compose.yml config > /dev/null && echo OK
```

Expected: `OK`. Warnings about missing env vars are fine — they come from the `.env` file on TrueNAS, not from this repo.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "deploy: pull team-budget image from ghcr, opt into watchtower

Switches the compose service from local build to
ghcr.io/emave/team-budget:latest and adds the Watchtower opt-in label.
Image CMD (docker-entrypoint.sh) handles migrations + server start."
```

---

## Task 6: Update README deployment section

Reflect the new push-to-deploy flow.

**Files:**
- Modify: `README.md` (Deployment section)

- [ ] **Step 1: Find and update the Deployment section**

Open `README.md` and locate the `## Deployment` heading and the `### Upgrades` subsection beneath it.

Replace the `### Run` and `### Upgrades` subsections (everything between `### Run` and `### Backups`) with:

```markdown
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
```

(Keep the `### Backups` and `### Without Docker` subsections that follow — leave them as-is.)

Also: the `## Deployment > Prerequisites` section currently lists "a host with Docker installed and a public HTTPS URL". Leave that and the "One-time setup" steps alone — they're still accurate for first install.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update deployment for ghcr + watchtower flow"
```

---

## Task 7: Push to main, watch CI, flip GHCR to public

This is the moment the new pipeline activates. Until this point everything is local; after this, pushing to main deploys.

**No file changes — verification only.**

- [ ] **Step 1: Push to origin/main**

```bash
git push origin main
```

- [ ] **Step 2: Watch the workflow**

```bash
gh run watch
```

Or open https://github.com/emave/team_budget/actions in a browser. Expected: `check` job passes, `build-and-push` runs after, both green. First build takes ~4–6 min on cold buildx cache.

- [ ] **Step 3: Verify the image landed in GHCR**

```bash
gh api /user/packages/container/team-budget/versions --jq '.[0:3] | .[] | .metadata.container.tags'
```

Expected: shows `latest` and `sha-<full-commit-sha>` tags on the most recent version.

- [ ] **Step 4: Flip the GHCR package to public**

GHCR packages default to **private** even when the source repo is public. Open in browser:

```
https://github.com/users/emave/packages/container/team-budget/settings
```

Scroll to "Danger Zone" → "Change package visibility" → set to **Public** and confirm by typing the package name.

- [ ] **Step 5: Verify anonymous pull works**

```bash
docker logout ghcr.io 2>/dev/null || true
docker pull ghcr.io/emave/team-budget:latest
```

Expected: pulls successfully without prompting for credentials.

Cleanup:
```bash
docker image rm ghcr.io/emave/team-budget:latest
```

- [ ] **Step 6: No commit needed**

This task only verifies remote state; nothing in the repo changed.

---

## Task 8: Cutover on TrueNAS (manual ops)

This is the one-time switch from the locally-built `team-budget:latest` to the GHCR-pulled image, and the Watchtower tuning. All steps run on the TrueNAS host.

**No file changes — manual ops. Use the SSH alias/user that matches your TrueNAS setup; the examples below use `truenas`.**

- [ ] **Step 1: Inspect current Watchtower config**

```bash
ssh truenas 'docker inspect watchtower --format "Args: {{json .Args}}{{println}}Env: {{json .Config.Env}}"'
```

Look at the output:
- If you see `WATCHTOWER_POLL_INTERVAL` set to a value ≤ 300 → polling is already fast enough.
- If you don't see it, default is 86400 (24h) — too slow. Plan to recreate Watchtower with `WATCHTOWER_POLL_INTERVAL=300`.
- If you see `WATCHTOWER_LABEL_ENABLE=true` or `--label-enable` in Args → label-scoped mode; our compose label opts us in.
- Note whether `WATCHTOWER_CLEANUP=true` is set; if not, plan to add it to avoid disk bloat.

- [ ] **Step 2: (Conditional) Recreate Watchtower with tuned env**

If Step 1 showed Watchtower needs poll-interval or cleanup adjustments, recreate it. The exact command depends on how Watchtower is currently deployed (TrueNAS Apps catalog, hand-rolled `docker run`, or compose). Two common patterns:

If Watchtower was started by `docker run`:
```bash
ssh truenas '
  docker stop watchtower &&
  docker rm watchtower &&
  docker run -d \
    --name watchtower \
    --restart unless-stopped \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e WATCHTOWER_POLL_INTERVAL=300 \
    -e WATCHTOWER_CLEANUP=true \
    containrrr/watchtower
'
```

If Watchtower is a TrueNAS Apps Catalog deployment, edit its env vars via the TrueNAS web UI (Apps → Watchtower → Edit) and let it restart.

If Watchtower is in a docker-compose file, edit the env vars there and `docker compose up -d watchtower`.

Verify after recreate:
```bash
ssh truenas 'docker logs --tail 20 watchtower'
```

Expected: log line like `Scheduling first run: ... in 5m`.

- [ ] **Step 3: Push the new compose to TrueNAS**

```bash
scp docker-compose.yml truenas:/path/to/team_budget/docker-compose.yml
```

(Use the actual path where the existing `docker-compose.yml` lives on TrueNAS.)

- [ ] **Step 4: Pull and recreate the team-budget container**

```bash
ssh truenas 'cd /path/to/team_budget && docker compose pull && docker compose up -d'
```

Expected: pulls `ghcr.io/emave/team-budget:latest` from GHCR, stops the old container, starts a new one from the GHCR image.

- [ ] **Step 5: Verify migrations + server startup on the host**

```bash
ssh truenas 'docker logs --tail 30 team-budget'
```

Expected log lines (in order):
1. `Migrations applied to /data/team_budget.db`
2. Next.js startup banner (`▲ Next.js 14.2.x`, `- Local: http://localhost:3000`, `- Network: http://0.0.0.0:3000`, `✓ Ready in ...`)

- [ ] **Step 6: Verify the public URL responds**

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://teambudget.org/login
```

Expected: `200`

- [ ] **Step 7: Verify the SQLite DB is intact**

```bash
ssh truenas 'sqlite3 /path/to/team_budget/data/team_budget.db "select count(*) from users; select count(*) from charges;"'
```

Expected: the same counts as before the cutover (your existing data). If these are zero on a previously-populated DB, **stop and roll back** (Step 8).

- [ ] **Step 8: (Only if Step 7 failed) Rollback**

Restore the previous compose and rebuild:
```bash
ssh truenas 'cd /path/to/team_budget && git checkout HEAD~1 -- docker-compose.yml && docker compose up -d --build'
```

Or pin to the previous image if known.

- [ ] **Step 9: No git commit**

This task only changes TrueNAS state; nothing in the repo changes.

---

## Task 9: End-to-end verification with a trivial push

Confirm the full loop works: push → CI → GHCR → Watchtower pull → container restart → app responds.

**Files:**
- Modify: any file with a no-op edit (e.g., `README.md` whitespace)

- [ ] **Step 1: Make a trivial change**

```bash
echo "" >> README.md
git add README.md
git commit -m "chore: trigger ci/cd end-to-end test"
git push origin main
```

- [ ] **Step 2: Watch CI complete**

```bash
gh run watch
```

Expected: both jobs green, ~2–3 min on warm cache.

- [ ] **Step 3: Capture the new image digest from GHCR**

```bash
gh api /user/packages/container/team-budget/versions --jq '.[0].name'
```

Note the digest (sha256:...). This is what Watchtower will pull.

- [ ] **Step 4: Watch Watchtower pick it up**

```bash
ssh truenas 'docker logs -f watchtower' &
```

Wait up to the poll interval (5 min after Step 2 if you set `WATCHTOWER_POLL_INTERVAL=300`). Expected log lines:
- `Found new ghcr.io/emave/team-budget:latest image (sha256:...)`
- `Stopping /team-budget`
- `Creating /team-budget`

Stop the tail with `Ctrl+C` and `kill %1`.

- [ ] **Step 5: Verify the new container is running the new image**

```bash
ssh truenas 'docker inspect team-budget --format "{{.Config.Image}} -> {{.Image}}"'
```

Expected: image ID matches the digest from Step 3.

- [ ] **Step 6: Verify the app still responds**

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://teambudget.org/login
```

Expected: `200`

- [ ] **Step 7: Sanity-check migration log on restart**

```bash
ssh truenas 'docker logs --tail 5 team-budget | grep -E "Migrations applied"'
```

Expected: `Migrations applied to /data/team_budget.db` (drizzle no-ops if everything is already applied — that's fine, the line still prints).

- [ ] **Step 8: No commit needed**

The trivial commit from Step 1 is the verification trigger. End-to-end loop verified.

---

## Done

After Task 9, the pipeline is live. Every push to `main`:
1. CI runs typecheck/lint/test.
2. On green, builds and pushes `ghcr.io/emave/team-budget:{latest,sha-<full>}`.
3. Watchtower polls GHCR within 5 min.
4. Container restarts, migrations re-apply (idempotent), server resumes.

Rollback: pin `image:` in `docker-compose.yml` on TrueNAS to a previous `sha-<…>` tag and `docker compose up -d`.
