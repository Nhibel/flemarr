import { z } from 'zod';

const archiveLayoutSchema = z.enum(['direct', 'zip-collection']);
export type ArchiveLayout = z.infer<typeof archiveLayoutSchema>;

const archiveSourceSchema = z.object({
  identifier: z.string().min(1),
  layout: archiveLayoutSchema,
  note: z.string().default(''),
});
export type ArchiveSource = z.infer<typeof archiveSourceSchema>;

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
  sources: z.array(archiveSourceSchema),
});
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
  coverage: z.number().min(0).max(1),
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
  // fly (raw ROM). zip-view: datanode view_archive extract — the fetched file
  // is itself a ZIP the downloader must open to reach the ROM (restricted/darked
  // re-zipped collections like ni-roms).
  container: z.enum(['direct', 'zip-entry', 'zip-view']),
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
