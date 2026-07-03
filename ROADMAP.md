# ROADMAP

Numbered phases. **Complete a phase before starting the next.** Each phase lists explicit acceptance criteria; the phase is "done" only when every criterion is checked.

**Current status: phases 0–7 are done and in daily use. Phase 8 (Dockerize) is the next and last one.** Where the implementation deviated from the original plan, a "Shipped notes" block under the phase records what was actually built.

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

- [ ] `docker compose up` brings the app up on a single port, ready to use.
- [ ] The image is under 250 MB.
- [ ] No build tools or source code ship in the runtime image.

---

## Beyond phase 8 — Authentication (only if exposing beyond the LAN)

Not planned as committed work, but tracked so it isn't forgotten. The app currently has **no authentication**; it is safe only on localhost or a trusted LAN. Making it reachable from the internet requires adding a gate first. The concrete risks, the options (VPN, authenticated reverse proxy, or a ~100-line single-password gate in the app), and the trade-offs are written up in [docs/security.md](./docs/security.md). Pick this up if and when internet exposure actually happens.
