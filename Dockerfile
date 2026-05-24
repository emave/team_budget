# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++ sqlite
RUN npm install -g pnpm@11.0.8

# Deps stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# Build-time placeholders so next.config + page rendering can resolve;
# real values come from runtime env at container start.
ENV BOT_TOKEN=build-time-placeholder
ENV BOT_USERNAME=build-placeholder
ENV BOOTSTRAP_ADMIN_TELEGRAM_ID=1
ENV NEXT_PUBLIC_BASE_URL=http://localhost:3000
ENV SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ENV TELEGRAM_WEBHOOK_SECRET=build-time-placeholder
ENV SKIP_BOT=1
ENV SKIP_CRON=1
RUN pnpm build

# Runtime stage
FROM base AS runner
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV NODE_ENV=production
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME
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
