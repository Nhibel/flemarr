import { z } from 'zod';

export const archiveLayoutSchema = z.enum(['direct', 'zip-collection']);
export type ArchiveLayout = z.infer<typeof archiveLayoutSchema>;

export const archiveSourceSchema = z.object({
  identifier: z.string().min(1),
  layout: archiveLayoutSchema,
  note: z.string().default(''),
});
export type ArchiveSource = z.infer<typeof archiveSourceSchema>;

export const archiveFileSchema = z.object({
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
export type AddSourceRequest = z.infer<typeof addSourceRequestSchema>;

export const removeSourceRequestSchema = z.object({
  identifier: z.string().min(1),
});
export type RemoveSourceRequest = z.infer<typeof removeSourceRequestSchema>;

export const getSourcesResponseSchema = z.object({
  system: z.string(),
  sources: z.array(archiveSourceSchema),
});
export type GetSourcesResponse = z.infer<typeof getSourcesResponseSchema>;

// Index preview
export const indexRequestSchema = z.object({
  identifier: z.string().min(1),
});
export type IndexRequest = z.infer<typeof indexRequestSchema>;

export const indexResponseSchema = z.object({
  identifier: z.string(),
  fileCount: z.number(),
  preview: z.array(archiveFileSchema),
  suggestedLayout: archiveLayoutSchema,
});
export type IndexResponse = z.infer<typeof indexResponseSchema>;

// Search
export const searchResultSchema = z.object({
  identifier: z.string(),
  title: z.string(),
  description: z.string(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Suggestions
export const suggestRequestSchema = z.object({
  datId: z.string().min(1),
});
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

export const sourceSuggestionSchema = z.object({
  identifier: z.string(),
  title: z.string(),
  layout: archiveLayoutSchema,
  fileCount: z.number(),
  coverage: z.number().min(0).max(1),
  sampleSize: z.number(),
});
export type SourceSuggestionDto = z.infer<typeof sourceSuggestionSchema>;

export const suggestResponseSchema = z.object({
  suggestions: z.array(sourceSuggestionSchema),
});
export type SuggestResponse = z.infer<typeof suggestResponseSchema>;

// Resolve
export const resolveRequestSchema = z.object({
  datId: z.string().min(1),
  gameIds: z.array(z.string().min(1)).min(1),
});
export type ResolveRequest = z.infer<typeof resolveRequestSchema>;

export const resolvedSourceSchema = z.object({
  identifier: z.string(),
  downloadUrl: z.string(),
  container: z.enum(['direct', 'zip-entry']),
});
export type ResolvedSource = z.infer<typeof resolvedSourceSchema>;

// One entry per ROM of the game — multi-disc games resolve every disc.
export const resolvedRomSchema = z.object({
  romName: z.string(),
  expectedCrc: z.string(),
  sources: z.array(resolvedSourceSchema),
});
export type ResolvedRom = z.infer<typeof resolvedRomSchema>;

export const resolvedGameSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  roms: z.array(resolvedRomSchema),
});
export type ResolvedGame = z.infer<typeof resolvedGameSchema>;

export const resolveResponseSchema = z.object({
  results: z.array(resolvedGameSchema),
});
export type ResolveResponse = z.infer<typeof resolveResponseSchema>;
