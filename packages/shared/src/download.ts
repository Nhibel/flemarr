import { z } from 'zod';

// One ordered candidate for fetching a rom. Different candidates can need
// different extraction instructions (e.g. a fast whole-container fetch
// first, falling back to the slower already-working zip-view resolution),
// which a flat downloadUrls[] + single extractFromZip couldn't express.
const downloadSourceSchema = z.object({
  url: z.string().url(),
  // The fetched bytes are a ZIP wrapping the ROM (restricted re-zipped
  // collections) — the downloader extracts the single entry before validating.
  extractFromZip: z.boolean().default(false),
  // Present only when this candidate is a whole archive container
  // (.zip/.7z/.rar) that must be downloaded in full and extracted locally —
  // see ResolvedSource's archive-container kind in archive.ts.
  innerPath: z.string().optional(),
  archiveFormat: z.enum(['zip', '7z', 'rar']).optional(),
});
export type DownloadSource = z.infer<typeof downloadSourceSchema>;

const downloadItemSchema = z.object({
  gameId: z.string().min(1),
  romName: z.string().min(1),
  expectedCrc: z.string().length(8),
  // Ordered candidates — the downloader falls back to the next one on
  // HTTP/network failure (never on CRC mismatch: bad source, user decides).
  sources: z.array(downloadSourceSchema).min(1),
});
export const downloadRequestSchema = z
  .object({
    datId: z.string().min(1),
    items: z.array(downloadItemSchema).min(1),
    // 'server' places validated files under destinationDir (a configured
    // library root); 'browser' stages them for the client to save locally —
    // destinationDir is meaningless there, since nothing lands on this host.
    target: z.enum(['server', 'browser']).default('server'),
    destinationDir: z.string().min(1).optional(),
  })
  .refine((v) => v.target === 'browser' || v.destinationDir !== undefined, {
    message: 'destinationDir is required when target is "server"',
    path: ['destinationDir'],
  });
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;
export type DownloadTarget = DownloadRequest['target'];

export const downloadJobSchema = z.object({
  jobId: z.string(),
});

export const downloadEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    gameId: z.string(),
    // A multi-disc game downloads one item per ROM under the same gameId —
    // romName disambiguates which one is progressing.
    romName: z.string(),
    bytesDownloaded: z.number(),
    totalBytes: z.number(),
  }),
  // The archive-container fast path's whole container finished downloading
  // (100%) and is now being decompressed locally to pull out this rom's own
  // entry — a real, sometimes multi-second step for a large per-game
  // archive, distinct from "downloading" (no percentage to report here).
  z.object({
    type: z.literal('file-extracting'),
    gameId: z.string(),
    romName: z.string(),
  }),
  z.object({
    type: z.literal('file-done'),
    gameId: z.string(),
    romName: z.string(),
  }),
  z.object({
    type: z.literal('file-ready'),
    gameId: z.string(),
    romName: z.string(),
    // Relative API URL the browser fetches to save the already-validated file.
    downloadUrl: z.string(),
  }),
  z.object({
    type: z.literal('file-failed'),
    gameId: z.string(),
    romName: z.string(),
    reason: z.string(),
  }),
  // Deliberately cancelled (one item, or every unfinished item when the
  // whole job is cancelled) — distinct from file-failed: a cancelled item
  // isn't a bad source, so the UI drops it from the list instead of
  // showing it as an error to investigate.
  z.object({
    type: z.literal('file-cancelled'),
    gameId: z.string(),
    romName: z.string(),
  }),
  z.object({ type: z.literal('cancelled') }),
  z.object({ type: z.literal('complete') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type DownloadEvent = z.infer<typeof downloadEventSchema>;
