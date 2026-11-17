# ROADMAP

Numbered phases. **Complete a phase before starting the next.** Each phase lists explicit acceptance criteria; the phase is "done" only when every criterion is checked.

**Current status: phases 0–8, 10, 12 and 13 are done; the app runs as a Docker service on the homelab and is in daily use. Phase 9 (Myrient) is blocked — the service shut down on 31 March 2026, see the note under the phase. Phase 11 (display modes + ScreenScraper) was retired on 2026-11-08 before its acceptance criteria were verified — see the note under the phase.** Where the implementation deviated from the original plan, a "Shipped notes" block under the phase records what was actually built.

---

## Phase 0 — Bootstrap

Set up the monorepo so that `pnpm install && pnpm dev` brings up both apps with no errors.

### Tasks

- Create `pnpm-workspace.yaml`, root `package.json` with workspace scripts (`dev`, `build`, `test`, `lint`, `typecheck`).
- Scaffold `apps/web` with Vite + React + TypeScript + Panda CSS. Hello-world page.
- Scaffold `apps/server` with Hono + Node 20+ + TypeScript. One `GET /api/health` endpoint returning `{ status: "ok" }`.
- Scaffold `packages/shared` with TS-only build (no bundling) — exports a placeholder type.
- Configure ESLint (typescript-eslint) and Prettier at the root, applying to every workspace.
- Configure `vitest` at the root, runnable per workspace.
- Configure absolute imports in each `tsconfig.json` (`@/*` for the app's own `src/*`, `@shared/*` for the shared package).
- Configure Vite dev server to proxy `/api/*` to the Hono server.
- Wire frontend health check: a button that calls `/api/health` and renders the result.

### Acceptance criteria

- [x] `pnpm install` succeeds with no warnings about peer dependencies the user has to resolve manually.
- [x] `pnpm dev` starts both apps; the web app loads at <http://localhost:5173> and the health-check button returns `{ status: "ok" }`.
- [x] `pnpm typecheck` passes across all workspaces.
- [x] `pnpm lint` passes across all workspaces.
- [x] `pnpm test` passes (even if it's just a smoke test).
- [x] `.gitignore` covers `node_modules`, `dist`, `styled-system`, `.env.*.local`, `.vite`, `*.log`.

---

## Phase 1 — DAT parsing

Parse uploaded DAT files into a typed in-memory representation, on the backend.

### Tasks

- In `packages/shared`, define Zod schemas for `Game`, `Rom`, `System`, `DatFile`. Infer TS types from them.
- In `apps/server/src/services/dat/`, implement a parser that takes a DAT file (string or buffer) and returns a `DatFile`.
  - Use `fast-xml-parser`.
  - Detect format flavor (No-Intro vs Redump) — they have slight schema differences. Document them in `docs/dat-format.md`.
  - Normalize entries: same shape regardless of source.
- Endpoint `POST /api/dats` — accepts a DAT file upload, parses it, returns a parsed summary `{ system, gameCount, source }` plus an id to fetch the full content later.
- Endpoint `GET /api/dats/:id/games` — returns the list of games with their ROMs.
- Store parsed DATs in memory for now (a `Map<id, DatFile>`). Persistence comes later. _(Superseded in phase 7: DATs live in SQLite.)_
- Unit tests with fixture DAT files for both No-Intro and Redump (small, two or three game entries each).

### Acceptance criteria

- [x] Upload a real No-Intro DAT (e.g. SNES) and a real Redump DAT (e.g. PS1) — both parse without errors.
- [x] The parsed `Game` entries have stable shape across both sources.
- [x] CRC32, MD5, SHA1, and size are correctly extracted for each ROM.
- [x] Unit tests cover: malformed XML, missing fields, multi-ROM games (disc-based), unicode names.
- [x] No `any` anywhere in the parser.

---

## Phase 2 — Browse and select

Frontend UI to upload a DAT, browse its games, and select a subset.

### Tasks

- DAT upload component (drag-and-drop + file picker).
- Game list view:
  - Searchable (fuzzy or substring — substring is fine to start).
  - Filterable by region (USA, EUR, JPN, World).
  - Filterable by category (Game, Demo, Add-on, etc.) if the DAT category preset exposes them.
  - Sortable by name, region, size.
- Selection state: checkbox per game, "select all filtered", "clear selection". Persist selection in `localStorage` keyed by DAT id.
- Selection summary panel: count + total size of selected games.

### Acceptance criteria

- [x] User can upload a DAT, see the games, search, filter, select, and the selection survives a page reload.
- [x] List renders smoothly with 10 000+ entries (virtualize if needed — use `@tanstack/react-virtual`).
- [x] Panda CSS is used for all styling; no inline styles, no other CSS frameworks.
- [x] Keyboard navigation works (arrow keys to move through list, space to toggle selection).

---

## Phase 3 — Local scanner

Scan a user-specified directory, hash files, match against a loaded DAT, propose renames.

### Tasks

- Endpoint `POST /api/scan` — body `{ datId, directory }`. Walks the directory recursively, computes CRC32 for each file, returns matches and unmatched.
- Match logic in a pure function in `apps/server/src/services/scanner/`:
  - For each file: compute CRC32, look up in the DAT's CRC index.
  - Match results: `matched` (file → DAT entry), `unmatched` (file with no DAT entry), `wrongName` (matched but filename differs from DAT canonical).
- Endpoint `POST /api/scan/rename` — body `{ renames: [{ from, to }] }`. Renames in place after validating destinations don't collide.
- Streamed progress: use Server-Sent Events for scan progress (one event per N files).
- Frontend page to: pick a directory (path text input is fine to start — no native picker on web), trigger scan, show matched / unmatched / rename suggestions, confirm renames.

### Acceptance criteria

- [x] CRC32 computation is fast enough to scan 5 000 files in under 30 seconds on a typical SSD.
- [x] Renames are atomic per file and roll back on partial failure (best-effort rollback of completed renames, then the batch stops; the response reports `done` / `failed` / `rolledBack`).
- [x] The scanner refuses to operate outside the configured root directory (path traversal guard).
- [x] Unit tests cover the matcher with synthetic ROMs and a known DAT.

---

## Phase 4 — archive.org integration

This is the hard phase. **Read `docs/archive-org-strategy.md` before starting.**

### Tasks

- Service `apps/server/src/services/archive-org/` exposing:
  - `searchSources(system)` — given a system, returns known archive.org identifiers that host its ROMs. Initial mapping is hand-curated and lives in `apps/server/src/services/archive-org/sources.ts`.
  - `getIndex(identifier)` — fetches and caches the archive.org metadata for an item, returns a list of files (name, size, CRC32 if present, container type: direct or zip-entry).
  - `resolveDownloadUrl(identifier, file)` — returns the URL to download an individual file, whether direct or via ZIP traversal.
- Endpoint `POST /api/resolve` — body `{ datId, gameIds }`. For each requested game, returns `{ gameId, sources: [{ identifier, file, downloadUrl }] }`. Empty `sources` means "not found, you'll have to find it elsewhere".
- Frontend integration: after selecting games, a "Find sources" action that calls `/api/resolve` and displays availability.

### Shipped notes

The hand-curated `sources.ts` mapping was replaced by something better while building the phase:

- Sources are stored per system in SQLite and managed from the UI (add / remove / test).
- Discovery is dynamic: archive.org full-text search plus a suggestion engine that scores candidate collections by probing their coverage of a sample of the loaded DAT (`suggest.ts`). `known-sources.ts` only seeds multi-system collection _candidates_ (ni-roms, proper1g1r-collection, …) that search can't surface; every run re-validates them.
- A third container type `zip-view` was added for access-restricted re-zipped collections — see `docs/archive-org-strategy.md`.
- Restricted collections require an archive.org account: `POST /api/archive/login` exchanges credentials for S3 keys and session cookies (xauthn, same flow as `ia configure`).

### Acceptance criteria

- [x] At least one system (e.g. SNES) resolves correctly for a known game, including the case where the source is a ZIP entry.
- [x] When a file is not found, the response is clear ("no source available") rather than a crash.
- [x] Metadata responses are cached (in memory is fine for now) with a TTL.
- [x] All archive.org calls go through the backend — the frontend never talks to archive.org directly.

---

## Phase 5 — Download manager

Actually download selected files, validate them, place them in the configured system directory.

### Tasks

- Endpoint `POST /api/downloads` — body `{ datId, gameIds, destinationDir }`. Queues downloads, returns a job id.
- Endpoint `GET /api/downloads/:jobId/events` — SSE stream of per-file progress, success, failure events.
- Endpoint `POST /api/downloads/:jobId/cancel` — cancels the job.
- Service `apps/server/src/services/downloader/`:
  - Concurrency-limited worker (default 2 in-flight downloads, configurable).
  - For each file: stream to a temp path, compute CRC32 on the fly, on success rename to the DAT canonical filename in `destinationDir`. On CRC mismatch, delete and report failure.
  - Resume support: if a partial file exists at the temp path, retry from scratch (range support is brittle on archive.org, don't rely on it initially).
- Frontend download manager UI: queue view, per-file progress bar, cancel button.

### Acceptance criteria

- [x] Download a real ROM end-to-end (resolve → fetch → validate CRC32 → place in destination).
- [x] CRC mismatch is detected and the file is not kept.
- [x] Cancellation works and cleans up temp files.
- [x] The UI updates in near-real-time as downloads progress.

---

## Phase 6 — Auto-fetch DATs from Fresh1G1R

Make the DAT upload step optional by pulling from Fresh1G1R automatically.

### Tasks

- Endpoint `GET /api/dat-sources` — lists available DAT files in the Fresh1G1R repo for the chosen preset (PropeR by default, switchable to McLean or Hearto). Uses GitHub's contents API.
- Endpoint `POST /api/dats/from-fresh1g1r` — body `{ preset, source, system }`. Downloads the DAT, parses it, registers it like an upload.
- Frontend: a "Browse Fresh1G1R" view next to manual upload.
- Cache fetched DATs to disk in a local data dir (e.g. `~/.rom-curator/cache/`) with the GitHub commit SHA as cache key.

### Acceptance criteria

- [x] User can pick a system from a dropdown and load its DAT in two clicks.
- [x] Re-fetching the same DAT when there's no upstream change hits the cache, not the network.
- [x] Both Redump and No-Intro DATs are listable per preset.

### Shipped notes

`GET /api/dat-sources` no longer uses GitHub's Contents API as described
above — swapped for the Git Trees API (f544ab5, November 2026) after
intermittent 502/503/504s traced to the Contents API's ~340KB response
for a ~250-entry directory (every entry repeats five full URLs). One
small lookup for the preset's tree sha plus a single recursive Trees
API call now replaces the two per-preset Contents calls, at about a
fifth of the payload, plus a couple of retries with short backoff on
502/503/504 as a safety net for whatever flakiness remains.

---

## Phase 7 — Persistence and config

Make state survive a server restart.

### Tasks

- SQLite database (better-sqlite3) for: parsed DATs, scan results, download history, per-system destination paths, settings.
- Migration framework — pick something simple (`drizzle-kit` or hand-rolled SQL files; do not over-engineer).
- Settings page in the frontend: configure per-system destination directories, preferred Fresh1G1R preset, concurrency, etc.

### Acceptance criteria

- [x] Restart the server: previously loaded DATs are still available, settings persist.
- [x] Settings UI covers every runtime-configurable knob the app uses.

---

## Phase 8 — Dockerize

Package everything into a single Docker image deployable to the homelab.

### Tasks

- Multi-stage `Dockerfile`: build stage installs deps and builds web + server, runtime stage is Node 20 alpine with only the built artifacts.
- Web app is served as static files by Hono (single port for both API and UI).
- `docker-compose.yml` with a named volume for `~/.rom-curator/` and bind mounts for the user's ROM directories.
- Document env vars in `.env.example` and in `README.md`.
- Bind the published port to `127.0.0.1` (not `0.0.0.0`) by default, and state in the README that internet exposure requires the auth work in [docs/security.md](./docs/security.md) — the app has no authentication of its own.

### Acceptance criteria

- [x] `docker compose up` brings the app up on a single port, ready to use.
- [x] The image is under 250 MB.
- [x] No build tools or source code ship in the runtime image.

### Shipped notes

Built and deployed early July 2026 (42256ca…7328c6d), running on the homelab via Portainer since. Deviations and additions vs the plan above:

- `pull_policy: build` in compose so Portainer builds the image locally instead of trying to pull it from a registry.
- The library is mounted through a single `ROMS_ROOT` boundary (`ROMS_HOST_DIR` on the host side) rather than one bind mount per ROM directory; directory browsing and fs-safety are confined to it.
- Startup banner logs the resolved config (port, ROM root, data dir, web root) for `docker logs` / Portainer.

---

## Phase 9 — Myrient as a secondary download source

> **Status: blocked (2026-07-11).** Myrient shut down on 31 March 2026 — `myrient.erista.me` now serves only a static closure page, on every path. The spec below stays valid for any HTTP mirror that reproduces the `files/{No-Intro|Redump}/{System}/` layout (the community backed up the full ~385 TB tree via torrents before the shutdown, so mirrors may reappear); the base URL is a setting by design, so unblocking means pointing it at a live mirror and validating the listing parser against its HTML. Do not start this phase while no such mirror exists — the acceptance criteria (end-to-end download) cannot be verified against a dead service.

Add [Myrient](https://myrient.erista.me/) — a public HTTP mirror of the No-Intro and Redump sets — as an additional download source feeding the downloader's existing multi-URL fallback. It complements archive.org rather than replacing it: no authentication, no zip-view containers, stable directory layout (`files/{No-Intro|Redump}/{System}/`), and files named exactly after the DAT entries. Since the downloader already verifies CRC32 after every fetch, name-based matching against Myrient carries no risk of silently keeping a wrong file.

Idea validated against "Myrient Can FixDAT" (analyzed 2026-07-10), which uses the same inference and matching approach in production.

### Tasks

- Service `apps/server/src/services/myrient/`:
  - `inferSystemUrl(dat, baseUrl)` — pure function that builds the system directory URL from DAT metadata: the Fresh1G1R filename convention when present, otherwise the DAT header (`<url>` containing `redump.org` → `files/Redump/<System>/`, `no-intro.org` → `files/No-Intro/<System>/`), with the same system-name cleanup rules in both paths (strip Retool/date suffixes).
  - `getListing(systemUrl)` — fetches and parses the HTML directory listing into `{ filename, size }[]`. Cached in memory with a TTL, same pattern as the archive.org metadata cache.
  - Matching by exact ROM filename against the listing — pure function, no network.
- Settings:
  - Configurable Myrient base URL, default `https://myrient.erista.me/`.
  - A global enable/disable toggle for the source.
  - Per-system URL overrides persisted in SQLite: when the inferred URL 404s (some systems live under folder names not derivable from the DAT), the user supplies the correct directory URL once and it is reused on every later resolve.
- Resolve integration: `/api/resolve` returns Myrient candidates alongside archive.org sources; the downloader's per-item `downloadUrls` list gets the Myrient URL as an additional candidate. Default order: Myrient first (direct, unauthenticated, stable), archive.org as fallback.
- Frontend: resolve results show which source(s) cover each game; settings page exposes the base URL, the toggle, and the stored per-system overrides (with delete).
- Document when Myrient applies vs archive.org in `docs/myrient-strategy.md` (or a section appended to `docs/archive-org-strategy.md` — pick whichever reads better, this is not a product decision).
- Tests: unit tests with HTML listing fixtures (table layout and plain-link layout) and DAT fixtures for URL inference (No-Intro, Redump, Fresh1G1R-named, unparseable header).

### Acceptance criteria

- [ ] For one No-Intro DAT and one Redump DAT from Fresh1G1R, the system URL is inferred with no manual input and the listing parses with correct names and sizes.
- [ ] A game downloads end-to-end from Myrient (resolve → fetch → CRC32 validation → placed in the system folder), including when archive.org has no source for it.
- [ ] When inference returns 404, the UI lets the user provide the directory URL once; it persists across server restarts and is used on subsequent resolves.
- [ ] Listings are cached: resolving twice for the same system hits the network once within the TTL.
- [ ] Disabling Myrient in settings restores archive.org-only behavior with no residual candidates in resolve results.
- [ ] All Myrient calls go through the backend — the frontend never talks to Myrient directly (same rule as archive.org).

---

## Phase 10 — Game details and pagination in the Games view

Replace the virtualized flat list with a paginated one (~25–50 games per page) whose rows are rich enough to show per-game details: boxart thumbnail and metadata, fetched lazily for the displayed page only and cached server-side so each game hits the external provider at most once ever.

### Tasks

- Pagination replaces `@tanstack/react-virtual` in `GameList.tsx`: paginate the client-side `filtered` array after `filterAndSort`. Search and filters stay global (they operate on the whole DAT, not the page); reset to page 1 whenever filters change. Removing the virtualizer frees row height for richer rows.
- Details fetched per displayed page only: one batched `POST /api/dats/:id/games/details` with the page's gameIds. Server-side SQLite cache (new `game_details` table, next migration) so each game is fetched from the external provider once; backend proxy, throttled — the frontend never talks to providers directly (same rule as archive.org and for the same reasons).
- Providers behind a common interface (`apps/server/src/services/game-details/`):
  - **libretro-thumbnails** for boxarts — URL built from the canonical No-Intro/Redump game name; no API, no account, no quota.
  - **ScreenScraper.fr** for French descriptions (CRC32 lookup; needs a user account; rate-limited) — optional second iteration, behind the same interface.
- Selection visibility (explicit user request):
  - A "selected only" filter toggle in `GameFilters` — the selection Set joins the filter chain in `use-game-filters`.
  - Optionally, `SelectionSummary` expandable into the list of selected games.
  - "Select all" keeps meaning "all filtered games", never "current page".

### Acceptance criteria

- [x] The Games view is paginated; search and filters behave exactly as before (global, instant) on the largest loaded DAT, and changing any filter resets to page 1.
- [x] Boxarts and details for a page load lazily; revisiting the same page (or restarting the server) serves them from the SQLite cache without re-hitting the provider.
- [x] A game the provider doesn't know renders a clean placeholder — no broken image, and the miss is negatively cached so it isn't refetched on every page visit.
- [x] The "selected only" toggle shows exactly the selected games; "select all" still selects all filtered games, not the current page.
- [x] No provider request ever originates from the browser — everything goes through the backend.

### Shipped notes

Shipped 2026-07-11 (ceb91dd…d768724). Verified end-to-end against the live provider with the three loaded DATs: SNES 6/6 boxarts, Mega Drive 5/6 (one genuine upstream miss), Sega CD 6/6 after adding a directory-name alias map (libretro uses hyphenated names for Sega CD and PC Engine CD where DAT headers use '&'). Details cache confirmed across a server restart (~330 ms for 6 fresh probes → ~7 ms from SQLite). ScreenScraper.fr descriptions stay a possible second iteration behind the same provider interface; the `description` column exists and is unused.

---

## Phase 11 — Display modes and ScreenScraper game info

> **Status: retired (2026-11-08), before verification.** Camille decided
> not to pursue ScreenScraper account setup — box art alone (phase 10)
> covers the need, and the extra account/devid dependency wasn't worth
> it for descriptions. The code was removed (see "Retired notes" below)
> rather than left unverified and bit-rotting. The spec below is kept as
> a historical record; if this is ever revisited, treat it as a fresh
> implementation rather than resuming the removed code, since the
> `game_details` schema and settings were cleaned up along with it.

Let the user pick how much each game row shows — **compact** (no image, dense), **normal** (boxart, the phase 10 default), **detailed** (large boxart + description, year, genre, publisher) — and feed the detailed mode from ScreenScraper.fr, with descriptions in the user's preferred language (`fr` default, `en` fallback).

Prerequisite: a ScreenScraper.fr user account **and** an approved developer id (requested on their forum) — the `jeuInfos.php` API requires both.

### Tasks

- Display-mode selector above the game list, persisted in `localStorage` (persistent-UI-state rule, ARCHITECTURE.md). Compact mode issues no details request at all.
- Settings: `screenScraperSsid` / `screenScraperSsPassword` / `screenScraperDevId` / `screenScraperDevPassword`, write-only across the API boundary exactly like the archive.org credentials (`…Configured: boolean` projection, never logged); `descriptionLanguage: 'fr' | 'en'` (default `fr`).
- Migration 003: `game_details` gains `year`, `genre`, `publisher`, `description_fr`, `description_en`, `info_fetched_at` — the info cache is independent from the boxart probe cache (`NULL info_fetched_at` = never asked).
- `services/game-details/screenscraper.ts`: `jeuInfos.php` lookup by CRC32 of the game's **largest** ROM (the `.bin`, not the `.cue`, for disc games). Both `fr` and `en` synopses are stored on every fetch, so switching the language setting never re-fetches. Throttled ~1 req/s; on quota exhaustion stop probing and serve what's cached — a quota failure is never cached as a miss.
- `/games/details` response gains `year` / `genre` / `publisher` / `description`, the description resolved server-side from the language setting.
- Detailed row layout in `GameRow`; settings page section for the ScreenScraper account and the language.

### Acceptance criteria

- [ ] The three display modes render correctly and the choice survives a reload; compact mode issues no details request.
- [ ] With a configured ScreenScraper account, a known game shows description (fr), year and genre in detailed mode; the data is served from SQLite on the next page visit and after a server restart.
- [ ] Switching the language setting fr↔en changes the displayed descriptions without any new ScreenScraper request.
- [ ] Exhausted quota or ScreenScraper downtime degrades gracefully: the page renders with whatever is cached and nothing gets negatively cached.
- [ ] Credentials are write-only: absent from `/api/settings` responses and from logs.

### Retired notes

Removed 2026-11-08 — `services/game-details/screenscraper.ts` deleted;
`services/game-details/index.ts` and `store.ts` reverted to boxart-only
(migration004 drops the six migration003 columns and clears the
leftover settings keys); the `detailed` display mode removed (only
`compact`/`normal` remain — `normal` already shows boxart); the
ScreenScraper settings section and `descriptionLanguage` removed from
the Settings page and from the shared schema. Box art (phase 10,
libretro-thumbnails) is untouched and remains the only per-game visual
info the app shows.

---

## Phase 12 — Download target: server or browser

Let downloaded files land either on the server's library folder (original
behavior) or be streamed straight to the browser's native download, for
users who run the app remotely but want files on their own machine.

### Tasks

- `target: 'server' | 'browser'` on the download request; server-target
  behaves exactly as before. Browser-target stages the validated file
  outside any library root and serves it once via a new streaming route
  (`Content-Disposition: attachment`), then deletes it — CRC32
  validation still happens server-side _before_ anything is handed to
  the client, so the integrity invariant never changes.
- Settings: `downloadTarget` picked once for the whole session (no
  per-click toggle) — there's no real case for mixing destinations
  within one session.
- The per-system folder stays relevant either way: the real destination
  in server mode, or just the folder the scanner expects files in once
  moved there by hand in browser mode. `SystemFolderBar`'s messaging
  adapts to which is true.

### Acceptance criteria

- [x] A download job set to `browser` validates the file server-side,
      then auto-triggers the browser's save dialog/download via SSE.
- [x] Switching `downloadTarget` in Settings changes what the resolve
      panel's single download button does, with no other UI change needed.
- [x] No regression to the server-target path (same destination,
      rename, history recording as before).

### Shipped notes

Shipped 2026-11-07/08 (e7454cf, 75d0d77, ed6dd78). Originally built as
two separate buttons in the resolve panel (one per target); moved into
a single Settings-driven choice per Camille's feedback that mixing
targets within a session has no real use case. `download_history`
records browser-target downloads with a `'<browser>'` destination
sentinel instead of a real path, for audit purposes only.

---

## Phase 13 — Auto-convert to CHD, and per-game download concurrency

Let downloaded disc-based games (PS1, Saturn, Sega CD, etc. — anything with a `.cue` in the DAT) be automatically folded into a single `.chd` file instead of staying as separate `.bin`/`.cue` files, matching what EmuDeck and most emulator frontends prefer for a smaller, tidier library. Fixing this properly for browser-target downloads exposed a scheduling bug in the downloader worth fixing in the same phase: concurrency was counted per file, not per game, so a single multi-file disc game could starve other queued games of the concurrency slots they should have had.

### Tasks

- Settings: `autoConvertChd` boolean (default off).
- `apps/server/src/services/downloader/chd.ts`: `convertGameToChd` runs `chdman createcd`, then verifies the round-trip bit-for-bit (`chdman extractcd` back out to a scratch dir, CRC32 each extracted file against the DAT's own expected CRCs) and only on a full match deletes the originals. Any failure (chdman error, a CRC that doesn't come back) leaves the originals untouched and cleans up only what it itself created.
- Downloader (`services/downloader/index.ts`): once every rom of an eligible game (one whose DAT roms include a `.cue`) has downloaded, the game is handed off for conversion. Server-target converts in place in the destination folder. Browser-target copies the roms into a scratch dir under their real canonical names first (chdman needs the `.cue`'s own referenced filenames to match real files on disk — the job-prefixed staging names don't), converts there, and offers the single resulting `.chd` to the browser instead of the two raw files; any conversion failure falls back to offering the originals individually, exactly as before the setting existed.
- Scanner (`services/scanner/chd-match.ts`): a `.chd` found during a scan is extracted (`chdman extractcd`) and each extracted file is CRC32'd and matched against the DAT like any ordinary file — a library that's already been converted still scans as fully owned, and the DAT's own `.cue` entry is inferred once every other rom of the game has matched (a `.chd`'s regenerated cue sheet is never byte-identical to the original, so it can never match by CRC on its own).
- Downloader concurrency restructured (`runQueue`) to admit one whole **game** per concurrency slot — every one of its own roms starts together, uncapped by the setting — instead of one file per slot.
- CHD conversion runs in its own background FIFO queue, decoupled from the download concurrency pool: a game's download slot frees the instant its files are all in, so later queued games keep downloading while an earlier one is still converting (chdman is CPU/disk-bound, not network, so it gains nothing from holding up a download slot). Conversions themselves still run one at a time.
- Downloads tab: a "Vider les téléchargements terminés" button clears finished/cancelled/errored job cards from the list without touching anything still running or converting.
- `Dockerfile`: both build and runtime stages switched from `node:20-alpine` to `node:20-slim` (debian, glibc) — `chdman` ships only native binaries (no WASM port exists), and glibc avoids the musl prebuilt-binary mismatch risk already hit once with `better-sqlite3`; the builder stage keeps a compiler toolchain installed as a fallback for any arch/Node-ABI combination without a prebuild.

### Acceptance criteria

- [x] A real multi-track PS1 game downloads, auto-converts to a single verified `.chd`, and the originals are deleted only after the round-trip CRC32 check passes.
- [x] A deliberately-failed conversion (bad CRC, chdman error) leaves the original `.bin`/`.cue` untouched and reports the failure — never destroys a known-good download.
- [x] Browser-target downloads of an eligible game offer one `.chd` save prompt instead of two raw files; a cartridge game (no `.cue`) is never gated behind this regardless of the setting.
- [x] A scan of a folder containing only `.chd` files (no raw `.bin`/`.cue`) still reports those games as fully owned.
- [x] Queuing several games at once no longer serializes behind one multi-file game's own downloads or its conversion.
- [x] Clearing finished downloads never removes a job that's still running or converting.

### Shipped notes

Shipped 2026-11-13. Found and fixed along the way, both before reaching production: `convertGameToChd`'s success path never actually set the `chdPath` its own return type required, so every real browser-target conversion silently reported `game-convert-failed: unknown error` despite having fully succeeded on disk — the existing test for that path only asserted `result.ok`, never `result.chdPath`, which is exactly why it slipped through; a test asserting the field was added alongside the fix. Also fixed: a sibling rom failing while another of the same game succeeded could leave the successful one's browser-save prompt permanently withheld with no fallback, since the conversion that would have triggered it never ran — the per-game concurrency restructure fixed this as a side effect, and a regression test locks it in.

---

## Phase 14 — Visual redesign: palettes, type, shell, and the install question

Rebuild the look from two validated design canvases (one on the visual
direction and the seven themes, one on the install flow), instead of the
accumulated styling the app had grown. Behaviour is deliberately almost
untouched: this is a restyle plus one new question, not a rewrite of what
the app does.

All of it lives on the `feat/ui-refresh` branch, which is **not merged
until the acceptance criteria below have actually been looked at in a
browser** — no session doing this work had one, so typecheck, tests and
built-CSS greps are the only things verified so far. They say nothing about
whether it looks right.

### Tasks

- **Palettes.** Eight themes become seven: Nintendo and Megadrive dropped
  (navy plus a saturated red read poorly down a long list, and the two were
  hard to tell apart), Contraste added. Every value is taken verbatim from
  the comps in `.rom-curator-data/design-directions/project/*.dc.html`,
  read per role out of each artboard. Roles no comp covers (all borders,
  danger, info, the second accent) are marked `derived` in the config and
  built only from hues that same artboard already uses. Two comp
  contradictions are documented inline where they were resolved.
- **Type.** Three roles: Space Grotesk for titles (one global `h1-h4`
  rule), Inter for body, IBM Plex Mono reserved for technical values —
  applied per value, never globally, so metadata gets its own voice without
  the app becoming a terminal. Self-hosted through `@fontsource*`, not a
  Google Fonts `<link>`: this runs on a homelab that may have no outbound
  internet. Plex Mono is latin-subset only (it renders nothing but digits
  and hex).
- **Shell.** Depth from shadows and from the surface being a different tone
  than the page, never from a 1px line — the built CSS now contains no
  `border:1px solid` at all, down from 39 sites. Fields are a filled recess
  (`bg.inset`), panels a filled surface with a shadow, active controls a
  tinted fill. Rows are 56px with a 44px boxart and an inset rounded
  selection. Mutually exclusive choices are segmented controls (tabs,
  display mode, loader mode, missing/all). The selection summary is a
  floating dock. Checkboxes are the native control tinted with the theme's
  accent.
- **Ownership in the library.** Each row carries its state from the last
  scan — on disk, misnamed, missing — with a header counter. `computeOwnership`
  generalises the CRC logic `computeMissingGameIds` already had. With no
  scan, or in browser mode where a server-side scan sees nothing, **no row
  carries a tag at all**: tagging 1500 rows "missing" on no evidence is
  worse than silence.
- **The install question.** One new setting, `topology`
  (`local | mounted | remote | null`), asked once before anything else
  because its answer decides both where downloads land and whether a scan
  can see anything. `local` and `mounted` produce identical settings; they
  are separate answers because "on this machine or a network share?" is
  answerable without knowing how the app works and "should downloads go to
  the server?" is not. It always writes `downloadTarget` with itself, from
  one mapping, which is why the old "Destination des téléchargements"
  settings section is gone — that was two controls for one decision.
- **Rules made unviolable rather than applied by hand.** Panda's `radii`
  scale is overridden in px, because the rem defaults meant every corner
  grew with the live font-size control. Contrast is a test
  (`theme-contrast.test.ts`) measuring 14 pairs across 7 themes with rgba
  washes composited over their surface, with one documented exception.

### Not done, deliberately

- **Dissolving the tabs** — the canvas would route the download action
  through the dock, making source resolution automatic. Dropped on
  Camille's instruction (2026-11-15): resolution stays something she
  triggers from the Sources tab.
- **A year on each row** — the canvas shows one; `gameSchema` has no such
  field and the DATs do not expose it, so it would mean ScreenScraper,
  which is out of scope.
- **A relative "checked 2 days ago"** — the scan result lives in React
  state and is lost on reload, so the header shows a clock time instead of
  implying a persistence that does not exist.
- **Sonic Mania's dark dock** — its artboard makes the dock a dark teal
  card while every other surface in it is light. There is no
  inverse-surface token, so the dock renders on `bg.surface` like
  everywhere else.

### Acceptance criteria

These are visual and cannot be automated. They are the checklist for
`pnpm dev` before this branch merges.

- [ ] All seven themes are legible end to end in Réglages → Apparence:
      muted metadata text, the three status tags side by side (Scanner
      after a scan), and the light theme over a long list.
- [ ] Nothing shifts position between consoles: the system name truncates
      and Lexique/Réglages stay put whatever its length.
- [ ] The filter row holds one line at 1280×800 (Steam Deck), and its
      menus open without pushing the list down.
- [ ] A search matching nothing still leaves a box to clear it.
- [ ] Rows are scannable down 1500 games with no dividers between them —
      the one rule here taken on faith, since the comps only ever showed
      four rows at a time.
- [ ] An existing install never sees the install question, and no frame of
      it flashes on a cold load.
- [ ] Réglages shows the current topology as the selected option, and
      changing it moves where the next download goes.
- [ ] Checkboxes are tinted with each theme's accent, at a comfortable
      size on the Deck's touchscreen.

---

## Phase 15 — System icons beside the system name

Camille asked whether an API could supply a logo per registered system, to
show next to the name. There is no need for one: `libretro/retroarch-assets`
(CC BY 4.0) holds nine icon sets as plain PNG files named on the same
No-Intro/Redump convention the DAT headers use, so the same "no key, no
quota, fetch a file" shape as the boxarts already in place covers it. The
alternatives with a real API — TheGamesDB, IGDB — need a key and a quota and
buy only brand wordmarks; ScreenScraper is out of scope (CLAUDE.md).

Chosen (Camille, 2026-11-17): the colour set `systematic` first, the white
silhouette `monochrome` as fallback, and if the mix reads badly on screen,
monochrome alone — that is a change of probe order, nothing else. Shown on
the home screen's system cards (40px), the open system's header (36px) and
the folder bar (20px). Not in the Fresh1G1R browser. A system with no icon
upstream shows its initial on a filled square, the same placeholder a game
row uses for a missing boxart.

What this is worth, measured against snapshots of both real lists (the
pinned commit `8c918e2` and the 348 system names of the Fresh1G1R PropeR
preset): **265 in colour, 29 as a silhouette, 54 with no icon at all**. The
54 are arcade boards, disc formats (Video CD, DVD-Video, Audio CD…) and a
few toys. Every mainstream console is covered, in colour, and a test asserts
that by name.

The matching is the substance: upstream and the DAT headers agree on the
convention and disagree on every detail ("NeoGeo" against "Neo Geo",
"TurboGrafx-16" against "TurboGrafx 16", "Atari - Atari 2600" against
"Atari - 2600"). Resolution is a match key that drops case, spaces and
punctuation, five shape rules, and 22 explicit aliases for machines filed
under another company upstream (`3DO Interactive Multiplayer` →
`The 3DO Company - 3DO`). The upstream commit is pinned, so the name index
is fetched once per installation and cached in the data directory.

Verified: 450 server tests and 220 web tests pass, lint, typecheck and build
are clean, and a live server resolved and proxied real icons — colour for
SNES, silhouette for Toshiba Pasopia, 404 for Video CD.

Looked at in a browser and accepted (Camille, 2026-11-17). The matching was
right on her own systems. One correction came out of it: the icons read as
blurry, because a clean 256px source reduced to 40px — 20px in the folder
bar — loses the thin outlines these colour drawings are built from. The
slots grew to 56 / 44 / 28 and the `<img>` carries
`image-rendering: high-quality`, which Chrome honours and the others ignore.
The fallback to monochrome alone was therefore not needed; it stays one
line away, the order of `STYLES`, if the mix ever stops working.

---

## Beyond the numbered phases — Authentication (only if exposing beyond the LAN)

Not planned as committed work, but tracked so it isn't forgotten. The app currently has **no authentication**; it is safe only on localhost or a trusted LAN. Making it reachable from the internet requires adding a gate first. The concrete risks, the options (VPN, authenticated reverse proxy, or a ~100-line single-password gate in the app), and the trade-offs are written up in [docs/security.md](./docs/security.md). Pick this up if and when internet exposure actually happens.
