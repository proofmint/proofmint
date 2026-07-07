# syntax=docker/dockerfile:1

# ---- deps: install node_modules (incl. devDependencies — tsx/prisma CLI are
# needed at runtime for the maintenance scripts under scripts/) ---------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# ---- builder: generate prisma client + build the app ------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate

# next build imports every API route to collect page data, which runs
# lib/const.ts's top-level "required env vars present" check. These
# placeholders only need to exist at build time — real values are supplied
# by docker-compose's env_file at container start and take over from there.
ENV EMAIL_SERVER_HOST=build EMAIL_SERVER_PORT=587 EMAIL_SERVER_USER=build \
    EMAIL_SERVER_PASSWORD=build EMAIL_FROM=build@build.local APPLICATION_HOST=http://build \
    VAULT_TOKEN=build VAULT_HOST=http://build IPFS_API_URL=http://build DATABASE_URL=mysql://build \
    JWT_SECRET=build ALGORAND_NETWORK=testnet ALGOD_RPC=http://build ALGOD_PORT=443 ALGOD_TOKEN=build \
    ADMIN_WALLET=build OPERATIONAL_WALLET=build ONBOARDING_WALLET=build \
    ADMIN_EMAIL=build@build.local ADMIN_PASSWORD=build UPLOADS_PATH=/app/uploads

RUN pnpm build

# ---- runner: the full built app (kept simple on purpose — this is a single
# self-hosted deployment, not something that needs a size-optimized image.
# Keeping the whole tree means `docker compose exec app pnpm <script>` just
# works for scripts/migrate-uploads-structure.ts, pin-to-ipfs.ts, etc.) ------
FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app ./

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node_modules/.bin/next", "start"]
