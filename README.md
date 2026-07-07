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

### Mounting your ROM library

Point `ROMS_HOST_DIR` **directly at your library folder** (not at its parent); it is mounted at `/roms` in the container, and that path (`ROMS_ROOT=/roms`) is the single root everything is confined to. The UI shows paths relative to that root (`/` is the library itself), so the mount point name never appears. In the app you then pick — or create on the spot — the folder of each system once, in the bar at the top of the system view; scans and downloads both use it. Nothing can touch the filesystem outside the library.

```sh
# .env
ROMS_HOST_DIR=/srv/roms   # the library folder itself — pointing at its parent
                          # would nest everything one level deeper in the app
```

### Configuration

| Variable               | Default     | Purpose                                                                  |
| ---------------------- | ----------- | ------------------------------------------------------------------------ |
| `BIND_ADDR`            | `127.0.0.1` | Host address the port binds to. Loopback by default (see security note). |
| `PORT`                 | `3000`      | Host port the app is published on.                                       |
| `ROMS_HOST_DIR`        | `./roms`    | Host directory holding your ROM library; mounted at `/roms`.             |
| `ROMS_ROOT`            | `/roms`     | In-container library root that browsing/scan/download are confined to.   |
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
