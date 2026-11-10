# archive.org strategy

This is the hardest part of the project. Read it before writing any archive.org code.

---

## Why it's hard

archive.org hosts ROM collections but is not designed as a ROM repository. The practical consequences:

1. **Collections are user-uploaded**, with inconsistent layouts. Some have one file per ROM. Some have one giant ZIP for an entire No-Intro set.
2. **Identifiers change.** A collection uploaded in 2022 as `nointro-snes-2022` may be re-uploaded under a different name later, and the original may be taken down.
3. **No official API for "find the ROM for game X on system Y".** We have to map systems to known-good identifiers ourselves.
4. **Rate limits exist** but are undocumented. Be polite: small concurrency, cache aggressively, honor 429s.
5. **CORS:** archive.org's responses generally allow CORS for `*` on the download endpoints, but be defensive. **Always go through the backend** so we control retries, caching, and don't expose CORS quirks to the user.

---

## The four cases we handle

### Pattern A — Direct file in the collection

The collection's file list contains the ROM as a top-level file.

- Metadata: `https://archive.org/metadata/<identifier>` returns a `files` array with entries like:
  ```json
  { "name": "Super Mario World (USA).sfc", "size": "524288", "crc32": "b19ed489" }
  ```
- Download URL: `https://archive.org/download/<identifier>/<urlencoded-filename>`

This is the happy path. Stream the URL, validate CRC32 against the DAT.

### Pattern B — Single file from inside a ZIP

The collection contains one or more big `.zip` files, and the ROM we want is a member of one of them.

- Metadata for the ZIP itself may include a nested file list under a `format: "ZIP"` entry — or it may not.
- archive.org provides a magic URL that streams a single member without downloading the whole archive:
  ```
  https://archive.org/download/<identifier>/<archive.zip>/<path-inside-zip>
  ```
  Both `<archive.zip>` and `<path-inside-zip>` are URL-encoded path segments.
- Example: `https://archive.org/download/no-intro-snes-2024-04/No-Intro%20SNES%202024-04.zip/Super%20Mario%20World%20%28USA%29.sfc`

To use this pattern, we need to know the ZIP's internal layout. The metadata rarely exposes it; instead we fetch the datanode's `view_archive.php` HTML listing for the ZIP (`https://<server>/view_archive.php?archive=<dir>/<zip>` — `server` and `dir` come from the item metadata) and parse the entry names out of it (`zip-listing.ts`). This works for restricted items too, and made central-directory parsing unnecessary.

### Pattern C — Restricted re-zipped collections (`zip-view`)

Some big collections (ni-roms, proper1g1r-collection, …) are access-restricted ("darked" for anonymous users) _and_ store one ZIP per system. The `archive.org/download/...` magic URL of Pattern B doesn't serve their members — but the datanode `view_archive.php` extract endpoint does, given session cookies:

```
https://<server>/view_archive.php?archive=<dir>/<zip>&file=<path-inside-zip>
```

The catch: the response is itself a small ZIP wrapping the requested ROM. The download item carries `extractFromZip: true` and the downloader unwraps the single entry (`fflate`) before CRC validation. In the shared schemas this is the `container: 'zip-view'` variant.

### Pattern D — Not found

The game isn't in any of the identifiers we know about. Surface this clearly in the UI: don't silently fail, don't pretend to download something that doesn't exist.

---

## Source mapping

No hand-curated mapping. Sources are **per-system rows in SQLite**, managed from the UI (`sources.ts` is the DB accessor). Each source is `{ identifier, layout: 'direct' | 'zip-collection', note }` — the layout is auto-detected from the index preview when the user adds one.

Two discovery paths feed the list:

1. **Full-text search** (`GET /api/archive/search`): queries archive.org's advancedsearch with the system name, sorted so multi-GB items (real collections) rank above single-game uploads.
2. **Suggestions** (`POST /api/archive/suggest`, `suggest.ts`): scores candidate collections by probing how many of an evenly-strided sample of the loaded DAT's **games** they actually contain, and reports a coverage percentage. For one-ZIP-per-system collections the coverage is measured against the ZIP's inner `view_archive` listing — the same path the resolver uses, so scoring and resolution agree.

   The sample is games, not ROM entries, and a game counts as present when _any_ of its ROMs matches (by CRC32, or by a file named after the ROM or after the game). Sampling entries instead systematically understated per-game-zip collections on disc systems: a Redump game is one `.cue` plus one `.bin` per track, so a ZIP named after the game could only ever match the cue — a 12-track game capped a perfect source at 8%. Coverage answers "do I get this game?", so games are what it counts. A partially-present disc is the resolver's business to report, not the suggester's.

   Two things the percentage does **not** mean. A `crcCoverage` of 0 is normal for any `zip-collection` source: a `view_archive` listing gives inner file names, never hashes, so such a source can only ever be name-matched. And a low `coverage` is often correct rather than a scoring failure — large Redump sets are published as alphabetical slices (`sony_playstation_part1` is "#-D" of five), and each slice genuinely holds only its share.

`known-sources.ts` seeds the suggestion run with multi-system collection _candidates_ (ni-roms, proper1g1r-collection, …) whose identifiers never mention a specific system, so search can't surface them. They are all No-Intro (cartridge) collections — `proper1g1r-collection` carries 173 systems and not one Sony entry — so they are seeded only for a No-Intro DAT; for a Redump DAT they could only waste scoring slots. They are re-validated on every run — a dead or renamed identifier simply stops appearing. Collection identifiers changing over time is handled by this re-validation, not by keeping a curated list fresh.

---

## archive.org account

Most large No-Intro/Redump collections are access-restricted; anonymous requests get 403s. The app supports authenticated access:

- **Login** (`POST /api/archive/login`, `login.ts`): the email + password are sent once to the `xauthn` endpoint — the same exchange the official `ia configure` CLI does — and traded for S3 API keys and the `logged-in-user` / `logged-in-sig` session cookies. All four values are stored in settings; **the password is never stored or logged**.
- **Every archive.org request** goes through `archiveFetch` (`fetch.ts`), which attaches `Authorization: LOW <access>:<secret>` and the session cookies. The datanodes check the _cookies_ (not the S3 header) for restricted `zip-view` extracts — both are sent.
- **Redirects are followed manually**: undici strips the Authorization header on cross-origin redirects, but `archive.org/download/*` redirects to datanodes (`ia80xx.us.archive.org`) that need it — the header is re-attached as long as the target stays on `*.archive.org`.
- Fallback: the settings page also accepts S3 keys and session cookies pasted manually (from `archive.org/account/s3.php` and browser DevTools) for the rare case where the xauthn exchange doesn't unlock an item.

---

## Caching

All caches are in-memory (safely lost on restart):

- **Item metadata** (`metadata.ts`): keyed by `identifier`, 24-hour TTL. A collection's file list rarely changes day-to-day.
- **ZIP inner listings** (`zip-listing.ts`): keyed by listing URL, 24-hour TTL.
- **Resolve results** (`resolver.ts`): keyed by `(datId, gameId)` — 24 hours when every ROM of the game was found, 15 minutes otherwise, so "not found" doesn't re-hammer on every selection change but recovers quickly when a source is added.
- **URL existence checks** (`url-check.ts`): HEAD probe results keyed by URL — 1 hour for hits, 15 minutes for misses.

---

## API surface (backend)

Schemas live in `packages/shared/src/archive.ts`; routes in `apps/server/src/routes/archive.ts`.

```ts
// GET    /api/archive/sources?system=<system>       → { system, sources: ArchiveSource[] }
// POST   /api/archive/sources                       body: { system, source } — layout auto-detected upstream
// DELETE /api/archive/sources/:identifier
// POST   /api/archive/index                         body: { identifier }
//        → { identifier, fileCount, preview: ArchiveFile[], suggestedLayout }
// GET    /api/archive/search?q=<query>              → { results: [{ identifier, title, description, itemSize? }] }
// POST   /api/archive/login                         body: { email, password } → { ok }
// POST   /api/archive/suggest                       body: { datId }
//        → { suggestions: [{ identifier, title, layout, fileCount, coverage, sampleSize }] }
// POST   /api/archive/resolve                       body: { datId, gameIds }
//        → { results: [{ gameId, gameName, roms: [{ romName, expectedCrc,
//             sources: [{ identifier, downloadUrl, container: 'direct' | 'zip-entry' | 'zip-view' }] }] }] }
```

Resolve returns one entry per ROM of the game — multi-disc games resolve every disc. The downloader consumes the `downloadUrl` values ordered by preference and never thinks about Pattern A vs B; the only container distinction it acts on is `zip-view` (`extractFromZip`), because the fetched bytes must be unwrapped before CRC validation.

---

## Validation is non-negotiable

Every downloaded file is validated against the DAT's CRC32 before being kept. If the CRC doesn't match:

- Delete the partial file.
- Log the mismatch (URL, expected CRC, actual CRC, size).
- Report failure in the SSE stream.
- Do **not** retry automatically with a different source. The user decides what to do.

A CRC mismatch usually means the source is bad (re-encoded, corrupted, or the identifier changed). It is not a network glitch.

### Name-only matches: a known, deliberate source of mismatches

`resolver.ts`'s `findMatch` tries a CRC32 match first, but falls back to a
filename match (extension ignored — basename compared after
`stripExtension`) when no file in the source reports that CRC (archive.org's
own metadata doesn't always expose `crc32`, or the real file's content
simply differs). The zip-view and zip-collection paths (`resolveViaZipListing`,
the HEAD-probe branch in `resolveRomInSource`) can **only** match by name —
a datanode listing or a HEAD request never exposes the file's hash. Every
`ResolvedSource` carries a `verified: boolean` reflecting this: `true` only
for an actual CRC32 equality, `false` for every name-based path. A `false`
match is a plausible guess, not a guarantee — the downloader's own CRC check
(above) is what actually decides, and it can still reject it.

**The concrete case that motivated tracking this explicitly (2026-11-08):
NES "Headered" vs "Headerless" DATs.** Fresh1G1R publishes both for
No-Intro NES. The Headered DAT expects the 16-byte iNES header to be part
of the dumped bytes (`Tetris (USA).nes`, CRC `d16ea396`); the Headerless one
expects it stripped (CRC `1394f57e`). Virtually every real-world NES dump in
circulation is headerless, but still named `.nes` — no real file and no
emulator (RetroArch's NES cores included) ever uses or recognizes the
`.unh` extension Fresh1G1R's Headerless DAT XML actually ships (it exists
purely so Retool can tell the two DAT variants' CRCs apart). Three fixes
landed together to deal with this (2026-11-09):

1. **`parser.ts` normalizes `.unh` → `.nes` at DAT load time**
   (`normalizeRomName`). Every downstream consumer — game list, scanner
   matching/rename, downloaded filenames — only ever sees `.nes`, matching
   what every real file and every emulator expects. Only the rom's CRC still
   encodes which DAT variant it came from; the filename no longer lies about
   playability. Without this, the scanner's rename feature would have
   offered to rename a working local `Tetris (USA).nes` to the fake
   `Tetris (USA).unh` on CRC match — breaking it — and a successful download
   would have landed on disk under a name RetroArch can't load.
2. **Extension-agnostic name fallback.** `findMatch` (resolver.ts) and
   `scoreIndex` (suggest.ts) compare basenames with the extension stripped,
   not compared verbatim. This mattered most before fix 1 — when the
   Headerless DAT still carried `.unh` names, no real `.nes` upload could
   ever match them by filename, so collections with no `crc32` in their
   index showed almost nothing for Headerless. With fix 1 in place the
   extensions already agree in the common case, but this stays as defense
   in depth for any other naming mismatch.
3. **Downloader-side iNES header recovery.** `apps/server/src/lib/ines-header.ts`'s
   `stripInesHeaderIfMatches` runs whenever the downloaded bytes fail their
   primary CRC check: if they start with the iNES magic (`NES\x1A`) and
   stripping the 16-byte header yields a CRC32 that matches what the DAT
   expects, the stripped bytes are kept and the download succeeds. This
   covers the common real case where a source (especially an older "clean
   romset") bakes the header into every file, but the Headerless DAT expects
   it gone. It's deliberately one-directional — there is no attempt to _add_
   a header to satisfy a Headered DAT, because the header encodes per-game
   mapper/mirroring/PRG-RAM bytes with no general way to derive them from
   the ROM data alone; guessing one could silently accept a corrupt file
   instead of failing honestly.

Net effect: resolving against the **Headerless** DAT is the one that can
actually succeed end-to-end — by CRC when the source exposes one, by a
properly-extensioned name guess otherwise, recoverable even if the
specific copy found still carries a header. The **Headered** DAT remains
structurally unable to download from a genuinely headerless real-world
dump, no matter what layer tries to help — there's no way to synthesize the
missing header's game-specific bytes from nothing.

`suggest.ts`'s `scoreIndex` has the same blended-match issue at the
collection-scoring level: its `coverage` fraction counts a name/ZIP-entry
match exactly like a CRC match. Re-encoded dumps are excluded from name
matching for the same reason the Headered case is hopeless — a `.chd`,
`.rvz` or `.wbfs` holds the game but not the bytes the DAT describes, so no
CRC it offers can ever match and every download from it would fail. It now also returns `crcCoverage` — the
CRC-only subset — so a candidate whose high "coverage" is mostly name
guesses (exactly what a Headered-DAT scoring run looks like) is visibly
different from one that's genuinely well-matched.

---

## Deferred / resolved

- **ZIP central directory parsing** — never needed: the datanode `view_archive.php` listing covers every collection met so far, including restricted ones.
- **Mirror selection.** Some uploaders mirror the same collection under multiple identifiers. Still deferred; the resolver simply returns every configured source as a fallback list.
- **Resume / range requests.** Still deferred; archive.org's range support varies, failed downloads restart from scratch.
