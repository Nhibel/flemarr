import { z } from 'zod';

const archiveLayoutSchema = z.enum(['direct', 'zip-collection']);
export type ArchiveLayout = z.infer<typeof archiveLayoutSchema>;

const archiveSourceSchema = z.object({
  identifier: z.string().min(1),
  layout: archiveLayoutSchema,
  note: z.string().default(''),
});
export type ArchiveSource = z.infer<typeof archiveSourceSchema>;

// A source as stored for a system. `searched`: whether a resolve looks in
// it — switched per source in the UI, on by default, kept across sessions.
const configuredSourceSchema = archiveSourceSchema.extend({
  searched: z.boolean(),
});
export type ConfiguredSource = z.infer<typeof configuredSourceSchema>;

const archiveFileSchema = z.object({
  name: z.string(),
  size: z.number(),
  crc32: z.string().optional(),
  format: z.string().optional(),
});
export type ArchiveFile = z.infer<typeof archiveFileSchema>;

// CRUD schemas
export const addSourceRequestSchema = z.object({
  system: z.string().min(1),
  source: archiveSourceSchema,
});
export const getSourcesResponseSchema = z.object({
  system: z.string(),
  sources: z.array(configuredSourceSchema),
});

export const setSourceSearchedRequestSchema = z.object({
  system: z.string().min(1),
  searched: z.boolean(),
});
export type SetSourceSearchedRequest = z.infer<typeof setSourceSearchedRequestSchema>;
export type GetSourcesResponse = z.infer<typeof getSourcesResponseSchema>;

// Index preview
export const indexRequestSchema = z.object({
  identifier: z.string().min(1),
});
export const indexResponseSchema = z.object({
  identifier: z.string(),
  fileCount: z.number(),
  preview: z.array(archiveFileSchema),
  suggestedLayout: archiveLayoutSchema,
});
export type IndexResponse = z.infer<typeof indexResponseSchema>;

// Search
const searchResultSchema = z.object({
  identifier: z.string(),
  title: z.string(),
  description: z.string(),
  // Total size of the archive.org item in bytes — a full ROM set weighs GBs,
  // which separates real collections from single-game uploads.
  itemSize: z.number().optional(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// archive.org account login (exchanged for API keys + session cookies,
// the password itself is never stored)
export const archiveLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Suggestions
export const suggestRequestSchema = z.object({
  datId: z.string().min(1),
});
const sourceSuggestionSchema = z.object({
  identifier: z.string(),
  title: z.string(),
  layout: archiveLayoutSchema,
  fileCount: z.number(),
  // Blended fraction (CRC + name-only matches) — used for ranking/filtering,
  // unchanged from before. crcCoverage is the CRC-verified subset of it, so
  // the UI can show how much of "coverage" is an actual guarantee vs a
  // name-only guess (see docs/archive-org-strategy.md).
  coverage: z.number().min(0).max(1),
  crcCoverage: z.number().min(0).max(1),
  sampleSize: z.number(),
});
export const suggestResponseSchema = z.object({
  suggestions: z.array(sourceSuggestionSchema),
});
export type SuggestResponse = z.infer<typeof suggestResponseSchema>;

// Resolve
export const resolveRequestSchema = z.object({
  datId: z.string().min(1),
  gameIds: z.array(z.string().min(1)).min(1),
});
const resolvedSourceSchema = z.object({
  identifier: z.string(),
  downloadUrl: z.string(),
  // direct: raw file. zip-entry: archive.org extracts a file from a ZIP on the
  // fly (raw ROM). zip-view: datanode view_archive extract — restricted/darked
  // collections only (archive.org/download/* 403s anonymously for these).
  // archive-container: a restricted per-game archive (.zip/.7z/.rar), fetched
  // whole via the plain (fast, works even restricted once authenticated)
  // download URL and extracted locally — see innerPath/archiveFormat/fallback
  // below and docs/archive-org-strategy.md's "Pattern E".
  container: z.enum(['direct', 'zip-entry', 'zip-view', 'archive-container']),
  // Whether the downloader must unzip the fetched bytes before CRC
  // validation. direct/zip-entry/archive-container: never — direct/zip-entry
  // already serve the raw ROM, and archive-container's own extraction step
  // handles this instead (see innerPath). zip-view: depends on the
  // *collection's own* layout, not just the container kind —
  // ni-roms/proper1g1r-collection re-zip each ROM one more time inside their
  // per-system ZIP ("Game.md" stored as "Game.zip" inside "<system>.zip"), so
  // the view_archive extract is itself a small ZIP to open. Redump's
  // per-game-zip collections (sony_playstation_part1-5) store the real
  // .bin/.cue files directly inside the per-game ZIP, so their view_archive
  // extract IS the raw ROM already — unzipping it would fail (it isn't
  // ZIP-formatted data at all). The resolver decides this per source by
  // checking the inner entry name it actually matched, not by assuming every
  // zip-view hit is re-zipped.
  extractFromZip: z.boolean(),
  // archive-container only: the exact entry to extract from the whole
  // container once it's downloaded, and the container's own format (its
  // own extension never changes based on the DAT, unlike the ROM's name).
  innerPath: z.string().optional(),
  archiveFormat: z.enum(['zip', '7z', 'rar']).optional(),
  // archive-container only: the slower-but-already-working zip-view
  // resolution for the same rom/source, used by the downloader if the fast
  // whole-container fetch or local extraction fails for any reason (network
  // error, corrupt archive, unsupported sub-format). Nested rather than a
  // second ResolvedSource in the same `sources` array — the UI's source
  // picker (ResolvedGameRow.tsx) keys and labels buttons by `identifier`,
  // and two entries from the same source would collide.
  fallback: z
    .object({
      downloadUrl: z.string(),
      container: z.enum(['direct', 'zip-entry', 'zip-view', 'archive-container']),
      extractFromZip: z.boolean(),
    })
    .optional(),
  // True only when archive.org's own metadata reported a CRC32 equal to the
  // DAT's expected one — a real guarantee. False means the match is by
  // filename (or ZIP-entry name) alone: plausible, but unconfirmed until the
  // download finishes and the downloader's own CRC check runs (which can
  // still fail it — see docs/archive-org-strategy.md).
  verified: z.boolean(),
});
export type ResolvedSource = z.infer<typeof resolvedSourceSchema>;

// One entry per ROM of the game — multi-disc games resolve every disc.
const resolvedRomSchema = z.object({
  romName: z.string(),
  expectedCrc: z.string(),
  sources: z.array(resolvedSourceSchema),
});

const resolvedGameSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  roms: z.array(resolvedRomSchema),
});
export type ResolvedGame = z.infer<typeof resolvedGameSchema>;

export const resolveResponseSchema = z.object({
  results: z.array(resolvedGameSchema),
});
export type ResolveResponse = z.infer<typeof resolveResponseSchema>;
