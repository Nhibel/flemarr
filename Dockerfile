# syntax=docker/dockerfile:1

# ── Builder ──────────────────────────────────────────────────────────────────
# Full workspace: install everything, build web + server, then produce a
# self-contained production install for the server package.
FROM node:20-alpine AS builder

# better-sqlite3 is a native module with no musl prebuilt binary — it compiles
# from source here. These build tools stay in the builder and never ship.
RUN apk add --no-cache python3 make g++

RUN corepack enable
WORKDIR /app

# Copy manifests + lockfile first so `pnpm install` is cached across source
# edits.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

# Build the web bundle and the server bundle (tsup inlines packages/shared and
# keeps runtime deps external).
COPY . .
RUN pnpm -r run build

# Flat, production-only node_modules for the server (includes the compiled
# better-sqlite3 binary, excludes tsup/vitest/typescript/@rom-curator/shared).
RUN pnpm --filter @rom-curator/server deploy --prod /prod

# ── Runtime ──────────────────────────────────────────────────────────────────
# Only the built artifacts and production deps. No pnpm, no source, no compilers.
FROM node:20-alpine AS runtime

# Native module needs the C++ runtime; alpine ships it separately.
RUN apk add --no-cache libstdc++

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    ROM_CURATOR_DATA_DIR=/data \
    WEB_ROOT=/app/web

COPY --from=builder /prod/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/web/dist ./web

# Persist the SQLite DB / DAT cache under a volume, owned by the non-root user.
RUN mkdir -p /data && chown -R node:node /data
VOLUME /data

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
