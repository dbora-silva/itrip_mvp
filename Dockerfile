# Pinned to match .nvmrc / .node-version / package.json "engines.node" (^24.12.0) exactly.
# Digest at the time this was pinned (for audit — the tag itself is what's actually used):
# sha256:c921b97d4b74f51744057454b306b418cf693865e73b8100559189605f6955b8
# To upgrade: bump .nvmrc, .node-version and this tag together, confirm the new tag exists
# (`docker manifest inspect node:<version>-alpine`), then update the digest comment above.
FROM node:24.12.0-alpine AS base

# ---- deps: install dependencies needed to build the app -----------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone Next.js server ----------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal runtime image ----------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Liveness only (does not depend on Supabase) — see /api/ready for a separate,
# externally-checked readiness probe documented in docs/local-environment.md.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
