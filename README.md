# rom-curator

A personal ROM library curator built around 1G1R DAT files.

## What it does

- **Load DAT files** from Redump and No-Intro collections (manual upload, or auto-fetch from [Fresh1G1R](https://github.com/UnluckyForSome/Fresh1G1R)).
- **Browse and filter** games per system.
- **Scan a local directory** for ROMs you already own, match them against the DAT by CRC32, and rename to the canonical 1G1R filenames.
- **Pick the games you want** and download them individually from archive.org sources.
- **Validate** every downloaded file against the DAT's CRC32 / SHA1 before keeping it.

## Stack

- **Frontend:** Vite + React + TypeScript + Panda CSS
- **Backend:** Hono + Node 20+ + TypeScript
- **Monorepo:** pnpm workspaces

## Status

Phases 0–7 are done and in daily use; phase 8 (Docker packaging) is the current work. See [ROADMAP.md](./ROADMAP.md).

## Running with Docker

The app ships as a single image: Hono serves the API at `/api/*` and the built UI at `/` on one port.

```sh
cp .env.example .env        # optional — adjust BIND_ADDR / PORT
docker compose up -d --build
```

The UI is then at `http://127.0.0.1:3000`. Data (the SQLite database and DAT cache) lives in the named volume `rom-curator-data`.

### Mounting your ROM directories

Bind-mount each system's folder into the container and configure the **in-container** path under Settings → system paths. File writes (renames, downloads) are confined to these paths. In `docker-compose.yml`:

```yaml
volumes:
  - rom-curator-data:/data
  - /srv/roms/snes:/roms/snes # then set "/roms/snes" in Settings
  - /srv/roms/psx:/roms/psx
```

### Configuration

| Variable               | Default     | Purpose                                                                  |
| ---------------------- | ----------- | ------------------------------------------------------------------------ |
| `BIND_ADDR`            | `127.0.0.1` | Host address the port binds to. Loopback by default (see security note). |
| `PORT`                 | `3000`      | Host port the app is published on.                                       |
| `ROM_CURATOR_DATA_DIR` | `/data`     | Where the SQLite DB and DAT cache live (a volume in the compose file).   |

### Deploying on a homelab server

- **Portainer** — Stacks → Add stack → _Repository_, point it at this repo and `docker-compose.yml`; Portainer clones and builds. (`better-sqlite3` compiles inside the image, so it adapts to the server's architecture.)
- **SSH** — `git clone`, then `docker compose up -d --build`.

### ⚠️ Security — read before exposing

The app has **no authentication**. It is safe on localhost or a trusted LAN only. The compose file binds to `127.0.0.1` on purpose. **Do not** expose it to the internet without an authenticated reverse proxy or a VPN in front, over HTTPS. The risks and options are in [docs/security.md](./docs/security.md).

## Local development

```sh
pnpm install
pnpm dev        # web on :5173 (proxies /api), server on :3000
```

## Working with Claude Code

The repo is set up for Claude Code. Start by reading [CLAUDE.md](./CLAUDE.md).
