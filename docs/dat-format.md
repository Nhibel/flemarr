# DAT format reference

A DAT file is an XML document describing every official ROM release for one system. We support both No-Intro and Redump flavors; their schemas are similar but not identical.

---

## Common shape

```xml
<?xml version="1.0"?>
<!DOCTYPE datafile PUBLIC "-//Logiqx//DTD ROM Management Datafile//EN" "http://www.logiqx.com/Dats/datafile.dtd">
<datafile>
  <header>
    <name>Nintendo - Super Nintendo Entertainment System</name>
    <description>Nintendo - Super Nintendo Entertainment System</description>
    <version>20260601-123456</version>
    <date>2026-06-01</date>
    <author>no-intro</author>
    <homepage>https://www.no-intro.org/</homepage>
    <url>https://www.no-intro.org/</url>
  </header>
  <game name="Super Mario World (USA)">
    <description>Super Mario World (USA)</description>
    <rom name="Super Mario World (USA).sfc" size="524288" crc="b19ed489" md5="..." sha1="..."/>
  </game>
  <!-- many more <game> entries -->
</datafile>
```

Single-disc cartridge games have exactly one `<rom>` child. Multi-disc games (PS1, Saturn, etc.) have one `<rom>` per disc.

---

## No-Intro specifics

- `<header><name>` is the system name (`"Nintendo - Super Nintendo Entertainment System"`).
- `<game name="…">` matches the ROM filename minus extension.
- Region is encoded in the game name in parentheses: `(USA)`, `(Europe)`, `(Japan)`, `(USA, Europe)`, `(World)`.
- Revision: `(Rev 1)`, `(Rev 2)`.
- Beta / proto / sample: `(Beta)`, `(Proto)`, `(Sample)`.
- Languages: `(En,Fr,De,Es,It)` — comma-separated 2-letter codes.
- Unlicensed: `(Unl)` suffix.
- 1G1R filtered DATs (Fresh1G1R) typically already drop most regional variants.

---

## Redump specifics

- `<header><name>` is the system name (`"Sony - PlayStation"`).
- Multi-disc: each `<game>` is one disc. `<game name="Final Fantasy VII (USA) (Disc 1)">` and `<game name="Final Fantasy VII (USA) (Disc 2)">` are separate entries — they need to be re-grouped at display time.
- `<rom>` entries point to the disc image. Format depends on the system:
  - PS1 / PS2: `.bin` + `.cue` (often `.bin` only, with `.cue` as a separate ROM under the same `<game>`).
  - GameCube / Wii: `.iso` (or `.gcm` for GC).
  - Dreamcast: `.gdi` + multiple `.bin`/`.raw`.
- This means a single game can have many ROM entries that must all be downloaded together.

**Implication:** the abstract `Game` type in our domain model has a list of ROMs, not one. Display logic groups multi-disc games for the UI.

---

## Fields we care about per ROM

| Field   | Type   | Notes                                                              |
| ------- | ------ | ------------------------------------------------------------------ |
| `name`  | string | Canonical filename. Use this when renaming.                        |
| `size`  | number | Bytes. Useful for quick sanity check before hashing.               |
| `crc`   | string | 8-hex-char CRC32. Lowercase it on parse. Primary identifier.       |
| `md5`   | string | 32-hex-char MD5. Stored but not used for matching by default.      |
| `sha1`  | string | 40-hex-char SHA1. Stored but not used for matching by default.     |

---

## Things that vary across DATs and that the parser must tolerate

- **`<header>` may be missing** in some Redump exports — fall back to the filename.
- **CRC casing** is sometimes uppercase, sometimes lower. Normalize to lowercase on parse.
- **`<rom>` may have a `status="nodump"` attribute** — a known-bad entry. Skip these for matching but keep them visible in the UI ("not yet dumped").
- **Unicode in names** — Japanese titles in Redump have UTF-8 game names. Make sure XML parser doesn't mangle them.
- **CRLF line endings** in DATs produced on Windows — `fast-xml-parser` handles this transparently, but if we ever read the file as bytes for hashing, be aware.

---

## Parser output shape (target)

```ts
// packages/shared/src/dat.ts
export const romSchema = z.object({
  name: z.string(),
  size: z.number().int().nonnegative(),
  crc: z.string().length(8).regex(/^[0-9a-f]{8}$/),
  md5: z.string().length(32).regex(/^[0-9a-f]{32}$/).optional(),
  sha1: z.string().length(40).regex(/^[0-9a-f]{40}$/).optional(),
  status: z.enum(['good', 'nodump']).default('good'),
});

export const gameSchema = z.object({
  id: z.string(),                 // hash of (name + first rom's crc), stable across reparses
  name: z.string(),
  description: z.string().optional(),
  region: z.array(z.string()),    // ['USA'], ['Europe'], ['World']
  languages: z.array(z.string()), // ['En','Fr','De']
  category: z.string().optional(),// 'Game', 'Demo', 'Beta', 'Proto', 'Unl'
  roms: z.array(romSchema).min(1),
});

export const datFileSchema = z.object({
  source: z.enum(['no-intro', 'redump']),
  system: z.string(),
  version: z.string().optional(),
  date: z.string().optional(),
  games: z.array(gameSchema),
});
```

The region/language/category fields are derived from the game `name` by a separate normalization step — keep that step pure and unit-tested.
