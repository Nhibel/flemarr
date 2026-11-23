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

No need to clone the repository: the app ships as a ready-made image (`ghcr.io/nhibel/flemarr`, amd64 and arm64). Two files are enough.

```sh
mkdir flemarr && cd flemarr
curl -fsSLO https://raw.githubusercontent.com/Nhibel/flemarr/master/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Nhibel/flemarr/master/.env.example -o .env
# edit .env: ROMS_HOST_DIR, and BIND_ADDR if you open the app from another machine
docker compose up -d
```

Open `http://127.0.0.1:3000` — or `http://<server-address>:3000` from another machine, once `BIND_ADDR=0.0.0.0` is set.

### Mounting your ROM library

Point `ROMS_HOST_DIR` **directly at your library folder**, not at its parent. It is mounted at `/roms` in the container, and everything the app does on disk is confined to it — nothing outside the library can be read or written. In the app, you then pick (or create) each system's folder once, in the bar at the top of the system view.

```sh
# .env
ROMS_HOST_DIR=/srv/roms
```

The container runs as the non-root user `node` (**UID 1000**): the library folder must be writable by that UID, or downloads and renames fail. On a NAS where shares belong to another user, `sudo chown -R 1000:1000 /srv/roms`, or grant UID 1000 write access to the share.

### Configuration

These three go in `.env`:

| Variable        | Default     | Purpose                                                                                                                                                             |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ROMS_HOST_DIR` | `./roms`    | Host directory holding your ROM library; mounted at `/roms`.                                                                                                        |
| `BIND_ADDR`     | `127.0.0.1` | Host address the port binds to. Loopback by default, so the app is reachable **only from the machine itself**; `0.0.0.0` opens it to your LAN — see Security below. |
| `PORT`          | `3000`      | Host port the app is published on.                                                                                                                                  |

The compose file also sets `ROMS_ROOT=/roms` (the in-container library root that browsing, scans and downloads are confined to) and `FLEMARR_DATA_DIR=/data` (the SQLite database and DAT cache, in the `flemarr-data` volume); there is no reason to change them.

Everything else — the 1G1R preset, download concurrency, per-system folders, the archive.org account, where downloads land, `.chd` conversion — is set from the app's **Settings** page and stored in its database.

### Deploying on a homelab server

- **Portainer** — Stacks → Add stack → _Web editor_, paste `docker-compose.yml`, and set `ROMS_HOST_DIR` and `BIND_ADDR` under _Environment variables_. Or _Repository_, pointing at this repository and `docker-compose.yml`.
- **SSH** — the quick start above.

To update: `docker compose pull && docker compose up -d` (in Portainer: _Update the stack_ with _Re-pull image_ on). Your data and settings live in the `flemarr-data` volume and survive updates.

### Building from source

To run a commit that is not released yet, build the image yourself from a clone:

```sh
git clone https://github.com/Nhibel/flemarr.git && cd flemarr
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

The first build takes a few minutes. In Portainer (_Repository_ mode), add `docker-compose.build.yml` under _Additional paths_.

Coming from rom-curator, the app's former name? See [docs/migrating-from-rom-curator.md](./docs/migrating-from-rom-curator.md).

## Troubleshooting

```bash
docker logs --tail 200 flemarr
```

Errors are logged with their cause, and everything a click triggers shares one `requestId`. For more detail, set `LOG_LEVEL=debug` in `.env` (or in the stack's environment variables) and run `docker compose up -d`. Logs never hold passwords or keys, but they do hold file paths and ROM names: read them before posting them in an issue.

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
