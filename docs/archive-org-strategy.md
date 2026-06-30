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

## The three patterns we need to handle

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

To use this pattern, we need to know the ZIP's internal layout. If the metadata doesn't expose it, we may need to fetch the ZIP central directory ourselves (HTTP range request to the end of the file — non-trivial but doable; defer this unless absolutely needed).

### Pattern C — Not found

The game isn't in any of the identifiers we know about. Surface this clearly in the UI: don't silently fail, don't pretend to download something that doesn't exist.

---

## Source mapping

Maintained as a hand-curated TypeScript file:

```ts
// apps/server/src/services/archive-org/sources.ts

export type ArchiveSource = {
  identifier: string;
  // Human-readable note about what's in this identifier (helps debugging).
  note: string;
  // 'direct' = ROMs as individual files. 'zip-collection' = one or more big ZIPs.
  layout: 'direct' | 'zip-collection';
  // Optional hint for matching files against DAT entries (some uploads add prefixes).
  filenameStrategy?: 'as-is' | 'strip-system-prefix';
};

export const SOURCES_BY_SYSTEM: Record<string, ArchiveSource[]> = {
  'Nintendo - Super Nintendo Entertainment System': [
    {
      identifier: '<TO BE FILLED IN BY USER OR DURING PHASE 4>',
      note: 'No-Intro SNES, individual files',
      layout: 'direct',
      filenameStrategy: 'as-is',
    },
  ],
  // ... fill in as we go
};
```

**This file is intentionally not pre-populated.** The user will fill it in during phase 4 based on what works at the time the app is built — collection identifiers change too often to hardcode them blindly here. The structure is the contract; the data is fresh.

---

## Caching

- **Metadata responses** are cached in memory keyed by `identifier`, with a TTL of 24 hours. A collection's file list rarely changes day-to-day.
- **Source resolution results** (which game maps to which file in which identifier) are cached keyed by `(system, gameId)` for the session — invalidated when the underlying DAT changes.
- **Negative results** ("not found in any known source") are cached too, with a shorter TTL (15 minutes), so the UI doesn't re-hammer for every selection change.

---

## API surface (backend, phase 4)

```ts
// GET /api/archive/sources?system=<system>
// → { sources: ArchiveSource[] }

// POST /api/archive/index
// body: { identifier: string }
// → { files: Array<{ name: string, size: number, crc32?: string, container: 'direct' | 'zip-entry', zipName?: string }> }

// POST /api/archive/resolve
// body: { datId: string, gameIds: string[] }
// → {
//     results: Array<{
//       gameId: string,
//       romName: string,
//       expectedCrc: string,
//       sources: Array<{ identifier: string, downloadUrl: string, container: 'direct' | 'zip-entry' }>
//     }>
//   }
```

The downloader (phase 5) consumes the `downloadUrl` values and never thinks about Pattern A vs B — that's resolved upstream.

---

## Validation is non-negotiable

Every downloaded file is validated against the DAT's CRC32 before being kept. If the CRC doesn't match:

- Delete the partial file.
- Log the mismatch (URL, expected CRC, actual CRC, size).
- Report failure in the SSE stream.
- Do **not** retry automatically with a different source. The user decides what to do.

A CRC mismatch usually means the source is bad (re-encoded, corrupted, or the identifier changed). It is not a network glitch.

---

## Things to defer (not phase 4)

- **ZIP central directory parsing.** Only relevant for Pattern B collections that don't expose their layout in metadata. If we hit this, build it then.
- **Mirror selection.** Some uploaders mirror the same collection under multiple identifiers; preferring the fastest one is a phase 5+ optimization.
- **Resume / range requests.** archive.org's range support varies; rely on full re-downloads first.
