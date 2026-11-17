# ARCHITECTURE

Cross-cutting technical decisions and the reasoning behind them. When in doubt, this file wins over individual code comments.

---

## High-level shape

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│   apps/web          │         │   apps/server       │         │  external           │
│   Vite + React      │  HTTP   │   Hono + Node 20    │  HTTPS  │  - archive.org      │
│   Panda CSS         │ ──────► │   TypeScript        │ ──────► │  - GitHub (Fresh)   │
│                     │  + SSE  │                     │         │                     │
└─────────────────────┘         └────────┬────────────┘         └─────────────────────┘
                                         │
                                         ▼
                                ┌─────────────────────┐
                                │  local filesystem   │
                                │  - ROM directories  │
                                │  - SQLite           │
                                │  - DAT cache        │
                                └─────────────────────┘
```

- The frontend is a pure SPA. No SSR. No Next.js. Vite produces a static bundle that the backend serves in production.
- The backend is the single source of truth for state and the only thing that touches the filesystem, archive.org, or GitHub.
- In dev, Vite's dev server proxies `/api/*` to the Hono backend (default port 3000).
- In production (phase 8), Hono serves the built static files at `/` and the API at `/api/*` on the same port.

---

## Why Hono and not Express / Fastify

- TypeScript-first; no `@types/*` packages needed to get good IntelliSense.
- Web-standard `Request` / `Response` API, which makes the code portable and easier to test.
- Built-in support for streaming responses (we need this for SSE in scan and download endpoints).
- Smaller surface area than Express — fewer things to misuse.

Trade-off: smaller ecosystem of middleware. For the few things we'd want (CORS, logging, body parsing, static files), Hono ships them or there's a one-file equivalent. Acceptable.

---

## Why a separate `packages/shared`

The Zod schemas for DAT entries, games, scan results, etc. are needed on both sides:

- Backend uses them to validate parsed data and to build API responses.
- Frontend uses them to validate API responses and to type the React layer.

Putting the schemas in `packages/shared` means a single definition; `z.infer<typeof schema>` gives the TS type on both sides. Avoids drift between "what the backend says" and "what the frontend expects".

`packages/shared` is TS-only and consumed via TS source (no build step in dev). For production builds we let `tsc --noEmit` validate it and Vite/tsup/whatever the apps use will compile it as part of their own build.

---

## Why a monorepo at all

Three workspaces (`web`, `server`, `shared`), one lockfile, one `pnpm install`. Avoids the "I added a type in shared and forgot to publish it" failure mode. pnpm workspaces are fine; no need for Turborepo or Nx at this scale.

---

## State and data flow

### Backend persistence

SQLite (`better-sqlite3`, hand-rolled SQL migrations in `apps/server/src/lib/migrations/`) stores everything that must survive a restart: parsed DATs, archive.org sources per system, download history, settings (including archive.org credentials). The database lives in `~/.rom-curator/` (`ROM_CURATOR_DATA_DIR` overrides it).

In-memory state is reserved for caches (archive.org metadata, ZIP listings, resolve results) and running jobs (scan/download job maps) — all safely lost on restart.

archive.org S3 keys and session cookies are stored in plaintext in the settings table. Deliberate: single-user homelab app, the SQLite file has the same trust level as the ROM directories next to it. The account password itself is never stored — it's exchanged once against keys and cookies (see `docs/archive-org-strategy.md`).

Those credentials are **write-only across the API boundary**: the client submits them (login exchange or manual paste) but the `/api/settings` responses never echo them back. `getSettings()` returns the full `Settings` for internal use (the archive.org fetch layer needs the values); the route projects it through `toSettingsResponse()`, which replaces each secret with a `…Configured: boolean`. So a compromised browser or a shoulder-surfer can't read back keys/cookies that were entered earlier — a real gain even on a LAN, and free.

### Backend-to-frontend data shapes

- Request and response bodies are typed via Zod schemas in `packages/shared`.
- Errors use a uniform envelope: `{ error: { code: string, message: string, details?: unknown } }` with HTTP status set appropriately.
- Long-running operations (scan, download) use Server-Sent Events. Pattern:
  - `POST /api/<op>` returns a `jobId`.
  - `GET /api/<op>/:jobId/events` is an SSE stream emitting `{ type, payload }` events until the job is done or cancelled.
  - `POST /api/<op>/:jobId/cancel` cancels.

### Frontend state

- **Server state** (DATs, scan results, archive.org sources, download jobs): TanStack Query.
- **UI state** (which row is selected, search input, filter chips): local component state.
- **Persistent UI state** (selection per DAT, last visited system): `localStorage`, keyed clearly so the schema can evolve.
- **No Redux / Zustand / Jotai** unless we hit a genuine need. We won't.

---

## Validation pipeline

Every byte that enters the backend goes through a Zod schema before anything else touches it. Every API response is built from a schema's `.parse()` (or constructed from typed data and validated in tests).

Pattern:

```ts
// in packages/shared
export const scanRequestSchema = z.object({
  datId: z.string().min(1),
  directory: z.string().min(1),
});

// in apps/server/src/routes/scan.ts
import { scanRequestSchema } from '@shared/scan.js';

app.post('/api/scan', async (c) => {
  const body = scanRequestSchema.parse(await c.req.json());
  // body is now fully typed and trusted
});
```

---

## Filesystem safety

The scanner, renamer, and downloader all touch the user's filesystem. Three rules:

1. **Configured roots only.** Every operation must target a path inside an allowed root. When `ROMS_ROOT` is set (the Docker deployment) it is _the_ single allowed root — the whole library lives under one bind-mounted tree, directory browsing is confined to it, and the UI only ever picks subfolders within it. When unset (local dev) the allowed roots fall back to the per-system paths from settings. This is centralized in `libraryRoots()` (`apps/server/src/lib/library-root.ts`), consumed by the scan/download guards and the `/fs` browse + create-dir routes. Within the root, each system's folder is chosen once in the system view (`SystemFolderBar`, persisted in `settings.systemPaths` keyed by the DAT system name) and both the scanner and the download destination read it — there is no per-operation path input. The UI displays paths relative to `ROMS_ROOT` (`apps/web/src/lib/paths.ts`); the API always exchanges absolute paths.
2. **No path traversal.** Resolve every user-provided path to its absolute form, then check that it's a prefix-match of an allowed root. Reject `..` segments before resolution.
3. **Renames are local.** Renames never cross filesystems (because they'd stop being atomic). If a destination is on a different mount, fail explicitly rather than silently copy.

Implement these checks in one place (`apps/server/src/lib/fs-safety.ts`) and use it everywhere. Don't reinvent the guard per route.

---

## Hashing

CRC32 is the practical identifier for ROM matching. It's what DAT files use as the primary key. We don't need a cryptographic hash for matching — we need a fast hash with the same algorithm the DAT used.

- Streaming CRC32 is hand-rolled in `apps/server/src/lib/crc32.ts` (table-driven, ~30 lines, `Crc32Accumulator` for streams).
- Stream the file: never load a full ROM into memory. PS2 ISOs can be multi-gigabyte.
- For downloads, compute CRC32 on the fly as bytes arrive. On mismatch with the expected value from the DAT, delete and report failure.

SHA1 / MD5 from the DAT are validated only if the user explicitly requests deep verification (post-MVP).

---

## CHD conversion

Disc-based systems (anything with a `.cue` in the DAT) can be auto-converted from raw `.bin`/`.cue` to a single `.chd` after download (`settings.autoConvertChd`, off by default) — via the `chdman` npm package, which wraps MAME's CHD tool. `chdman` ships only native, per-platform binaries; there's no WASM build, which is why the runtime image is `node:20-slim` (glibc) rather than alpine (musl) — see the Dockerfile's comments.

A CHD's own bytes never reproduce the DAT's raw-byte CRC32, so both the conversion step and the scanner verify/match by **decompressing and re-hashing**, never by trusting a CHD-level checksum:

- **Conversion** (`services/downloader/chd.ts`): `chdman createcd`, then `chdman extractcd` back out to a scratch dir and CRC32 each extracted file against the DAT's expected CRCs. Only a full match deletes the originals; any mismatch or tool error leaves them untouched.
- **Scanning** (`services/scanner/chd-match.ts`): the same extract-then-CRC32 approach feeds a `.chd`'s contents into the ordinary CRC-matching path, so a library that's already been converted still scans as fully owned. The DAT's own `.cue` rom is inferred matched once every other rom of the game has matched by CRC — a CHD's regenerated cue sheet is never byte-identical to the original, so it can never match on its own.

---

## Concurrency

- **Scanner:** parallelize CRC32 computation across files. Limit to `os.cpus().length` workers (use `worker_threads` if necessary, or just `Promise.all` with a queue — start simple).
- **Downloader:** `settings.downloaderConcurrency` (default 2) bounds how many **games** are in flight at once, not how many files — every rom of an admitted game starts together, uncapped by the setting. A multi-file disc game (bin + bin + cue) must not, by itself, occupy every slot and starve other queued games; see `runQueue`'s per-game grouping in `apps/server/src/services/downloader/index.ts`.
- **CHD conversion** (see below) runs in its own background FIFO queue, entirely decoupled from the download concurrency pool — it must never hold a game's download slot for its own (CPU/disk-bound) duration.
- **archive.org metadata:** serialize requests per identifier — a stampede on the same identifier is wasted bandwidth.

---

## Theming and visual rules

All of this lives in `apps/web/panda.config.ts`. It is written down here
because several of the rules look like oversights from inside a single
component, and undoing one of them re-breaks something that was fixed.

- **Seven themes, one `data-theme` attribute** on `<html>`, not a theme ×
  light/dark matrix. `base` in the semantic tokens _is_ the light theme, so
  there is no `light` condition. Adding a theme means a condition in
  `conditions.extend`, a value under **every** token leaf, and an entry in
  both `use-theme.ts` and the Apparence section. A leaf missing a theme's
  value silently falls back to `base` — i.e. to the light theme — with no
  error, so the value count must match the leaf count.
- **Depth comes from shadows and surface tone, never from a 1px line.**
  The built CSS contains no `border:1px solid`. The one exception is a
  divider _inside_ a card (`border-top` on a panel footer). Fields are a
  filled recess (`bg.inset`), panels a filled surface with a shadow, active
  controls a tinted fill.
- **Radii are px, not rem.** Panda's defaults are rem, which made every
  corner grow with the live font-size control (`src/lib/use-font-scale.ts`)
  — at 24px a card rounded into a lozenge. The whole `radii` scale is
  overridden in px, including unused steps. Use the tokens; do not
  reintroduce literal px in components.
- **Touch targets are px too**, for the same reason: they must not shrink
  when the text is made larger to help.
- **Three type roles.** Space Grotesk for titles (one global `h1-h4`
  rule), Inter for body, IBM Plex Mono applied **per value** for technical
  data — sizes, CRCs, counts, pagination — never globally. Self-hosted via
  `@fontsource*`, never a Google Fonts `<link>`: this runs on a homelab
  that may have no outbound internet.
- **A status tag reads from `chip.*`, not `status.*`.** Six themes draw a
  tag as a tinted wash with the status colour as text; Cyberpunk draws it
  as a solid fill with dark text. Both shapes live in the tokens, so
  `Chip`, `StatusTag` and `LayoutBadge` never branch on the theme. The
  same status spoken as _prose_ keeps `status.*.text` on whatever surface
  it sits on — that is why the two pairs exist. Keep `chip.*` in step when
  a status colour changes.
- **Mono values read from `fg.data` / `fg.dataFaint`.** Technical values in
  the mono face get their own colour role, so Cyberpunk can put them in
  cyan while the other six keep exactly the `fg.subtle` / `fg.faint` they
  had. Two steps, not one, so those six do not lose contrast to buy one
  theme's cyan. Not for mono text already inside a coloured container (the
  dock, a `Chip`'s own count, a source id in `accent.text`).
- **Contrast is a test**, not a promise: `theme-contrast.test.ts` measures
  23 pairs across the 7 themes, compositing translucent washes over their
  surface first. No exceptions are currently accepted. Anything not on
  that list has to clear 4.5:1 (3:1 for the two decorative `faint` roles).

**Cyberpunk and Contraste were rebuilt together on 2026-11-17** from a
third canvas. They had converged into the same theme — a neutral
near-black page under a yellow-green accent — and seven of the nine
colours in the supplied Cyberpunk 2077 palette were unused, its own black
among them (Raisin Black `#272932`, which is violet, not neutral).
Contraste now carries, value for value, the palette that used to be
Cyberpunk's; Cyberpunk is the canvas's "Overdrive" artboard: saturated
violet ground, solid status tags, cyan technical values, a magenta card
shadow, all nine palette colours in use. One rule is deliberately broken
there and only there — Cyberpunk's filter triggers are tinted by family
(Région cyan, Catégorie violet), which spends a vivid hue on something
that is neither the primary action nor the selection. It is on the
artboard and the cost was named before it shipped.

The design canvases these came from are private Artifacts; their working
files are gitignored under `.rom-curator-data/`. ROADMAP.md's Phase 14
records the decisions and the deliberate departures from the comps.

---

## Logging

- Backend: structured logs via `pino` (`apps/server/src/lib/logger.ts`). Log every API request with method, path, status, duration. Log every external HTTP call (archive.org, GitHub) with target, status, duration. Never log credentials or cookies — paths and identifiers only.
- Frontend: console only. Don't ship logs anywhere.
- No PII to worry about (single-user homelab app), but still no need to log file contents — just paths.

---

## Testing strategy

- **Unit tests** for everything pure: DAT parser, CRC32 hashing, filename matching, fs-safety guards, archive.org URL resolution.
- **Integration tests** for routes: spin up Hono in-process, hit endpoints with `fetch`, assert on responses. Use a tmp dir for filesystem ops.
- **No E2E browser tests in early phases.** Add Playwright later if the UI becomes complex enough to justify it.
- **Coverage** is not a target. Coverage of the parser, hasher, matcher, and fs-safety guard should be effectively 100%. Coverage of the UI is incidental.

---

## What we deliberately do not do

- **No Redux, Zustand, Jotai.** TanStack Query covers server state; React's built-ins cover the rest.
- **No tRPC.** REST + Zod gives us typed clients without coupling the frontend build to the backend's TS.
- **No GraphQL.** Overkill for ~30 endpoints.
- **No ORM.** SQLite + hand-written SQL via `better-sqlite3`, hand-rolled migrations. Held up fine through phase 7; no query builder needed.
- **No auth (yet).** Single user, single machine — every `/api/*` route is open, which is safe only on localhost or a trusted LAN. This is a consequence of the local-only assumption, not a permanent decision: exposing the app beyond the LAN requires adding authentication first (reverse-proxy auth / VPN, or a single-password gate in the app). The risks and options are documented in [docs/security.md](./docs/security.md).
- **No SSR / Next.js.** Already rejected, listed here so we don't drift back.
