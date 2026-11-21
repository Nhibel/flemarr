# syntax=docker/dockerfile:1

# ── Builder ──────────────────────────────────────────────────────────────────
# Full workspace: install everything, build web + server, then produce a
# self-contained production install for the server package.
# debian-slim (glibc), not alpine (musl): chdman (CHD conversion) ships only
# native binaries, no WASM port exists — a musl build risked the exact
# prebuilt-binary mismatch already hit once with better-sqlite3 below. On
# glibc, better-sqlite3 also gets a prebuilt binary instead of compiling.
FROM node:20-slim AS builder

# debian-slim ships no compiler toolchain at all (same reason alpine
# needed its own python3/make/g++ below, before the glibc switch) — kept
# as a fallback here even though glibc prebuilds are expected to cover
# better-sqlite3/chdman, since a missing prebuild for some arch/Node ABI
# combination would otherwise fail `pnpm install` outright with no way to
# compile from source instead.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

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

# Flat, production-only node_modules for the server (includes the
# better-sqlite3/chdman native binaries, excludes tsup/vitest/typescript/
# @flemarr/shared).
RUN pnpm --filter @flemarr/server deploy --prod /prod

# ── Runtime ──────────────────────────────────────────────────────────────────
# Only the built artifacts and production deps. No pnpm, no source, no compilers.
FROM node:20-slim AS runtime

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
