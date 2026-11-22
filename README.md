<p align="center">
  <img src="apps/web/src/assets/logo.svg" alt="Flemarr" width="480">
</p>

<p align="center">
  <strong>A self-hosted manager for your retro game ROM collection.</strong><br>
  Pick a console, see every game released on it, tick the ones you want, download them one by one.
</p>

<p align="center">
  🇫🇷 <a href="./README.fr.md">Lire en français</a>
</p>

---

Downloading a whole collection pack to get one game, or clicking through ad-ridden sites to fetch a single Game Boy ROM, gets old fast. Flemarr gives you the clean list of games for each system, tells you which ones you already have, and fetches the missing ones individually.

## Features

- **Clean game lists.** Each system's list comes from the No-Intro (cartridges) and Redump (discs) references, filtered to **one version per game** (1G1R) — no duplicates, no betas, no ten regional variants. The lists are fetched from [Fresh1G1R](https://github.com/UnluckyForSome/Fresh1G1R), updated daily; you can also import your own `.dat` file.
- **Box art** for every game, from libretro-thumbnails.
- **Know what you own.** Scan a system's folder: files are identified by their content (CRC32), not their name, so the app recognises games even when they are badly named — and offers to rename them to their official name.
- **Download game by game** from archive.org, either straight into the system's folder on the server, or through your browser to your own computer. Every file is checked against the reference before it is kept.
- **Disc games in one file.** PlayStation, Saturn and other disc games can be converted automatically from `.bin`/`.cue` to a single `.chd`, verified track by track before the originals are deleted. Optional.
- **Downloads keep running** in the background, survive a page reload, and leave a 30-day history.
- Several themes, adjustable text size, and a layout that works on a Steam Deck or a phone.

## How it works

Flemarr is a web app that runs in Docker on your own machine — a NAS, a home server or a PC — and that you open in your browser.

On first launch it asks one question: **where should downloaded games land?**

- **In a folder on the server** — games are filed and named for you, and the app can scan the folder to see what you already have.
- **In your browser's downloads** — you file the games yourself; the app shows the full list without knowing what you own.

Then add a system, choose its folder, and browse.

New to all this? The [user guide](./docs/guide-utilisateur.md) (in French) explains ROMs, DAT files and 1G1R from scratch, no technical background assumed.

## Requirements

- **Docker** with Docker Compose.
- **An archive.org account** (free). Most ROM collections on archive.org are access-restricted: you log in once from the app's settings. Your password is exchanged for access keys and never stored.

## Quick start

```sh
git clone https://github.com/Nhibel/flemarr.git
cd flemarr
cp .env.example .env        # then set ROMS_HOST_DIR to your ROM library folder
docker compose up -d --build
```

Open `http://127.0.0.1:3000`.

There is no prebuilt image: the stack builds from the Dockerfile, which takes a few minutes the first time.

### Mounting your ROM library

Point `ROMS_HOST_DIR` **directly at your library folder**, not at its parent. It is mounted at `/roms` in the container, and everything the app does on disk is confined to it — nothing outside the library can be read or written. In the app, you then pick (or create) each system's folder once, in the bar at the top of the system view.

```sh
# .env
ROMS_HOST_DIR=/srv/roms
```

### Configuration

| Variable           | Default     | Purpose                                                                       |
| ------------------ | ----------- | ----------------------------------------------------------------------------- |
| `BIND_ADDR`        | `127.0.0.1` | Host address the port binds to. Loopback by default — see Security below.     |
| `PORT`             | `3000`      | Host port the app is published on.                                            |
| `ROMS_HOST_DIR`    | `./roms`    | Host directory holding your ROM library; mounted at `/roms`.                  |
| `ROMS_ROOT`        | `/roms`     | In-container library root that browsing, scans and downloads are confined to. |
| `FLEMARR_DATA_DIR` | `/data`     | Where the SQLite database and DAT cache live (the `flemarr-data` volume).     |

Everything else — the 1G1R preset, download concurrency, per-system folders, the archive.org account, where downloads land, `.chd` conversion — is set from the app's **Settings** page and stored in its database.

### Deploying on a homelab server

- **Portainer** — Stacks → Add stack → _Repository_, point it at this repository and `docker-compose.yml`. Portainer clones and builds it.
- **SSH** — `git clone`, then `docker compose up -d --build`.

To update, pull the latest commit and rebuild (in Portainer: _Pull and redeploy_).

Coming from rom-curator, the app's former name? See [docs/migrating-from-rom-curator.md](./docs/migrating-from-rom-curator.md).

## ⚠️ Security

Flemarr has **no authentication**. It is meant for localhost or a trusted home network only, which is why the compose file binds to `127.0.0.1`. Set `BIND_ADDR=0.0.0.0` only on a LAN you trust, and **never** expose it to the internet without an authenticated reverse proxy or a VPN in front, over HTTPS: anyone who reaches it can use your archive.org account and write to your library. Details and options: [docs/security.md](./docs/security.md).

## Legal

Flemarr is a collection manager: it hosts no games and ships no ROMs. Copyright law on ROMs varies by country; only download games you are entitled to.

## Development

pnpm workspaces monorepo: Vite + React + TypeScript + Panda CSS for the web app, Hono on Node 20+ for the server, SQLite for storage, Vitest for tests.

```sh
pnpm install
pnpm dev        # web on :5173 (proxies /api), server on :3000
pnpm -r test
```

[ARCHITECTURE.md](./ARCHITECTURE.md) covers the design, [ROADMAP.md](./ROADMAP.md) what was built and why, and [CLAUDE.md](./CLAUDE.md) the conventions the code follows — the project is developed with Claude Code.

Ideas, bugs, feedback: open an issue.

## License

[MIT](./LICENSE)
