import { z } from 'zod';

const downloadItemSchema = z.object({
  gameId: z.string().min(1),
  romName: z.string().min(1),
  expectedCrc: z.string().length(8),
  // Ordered candidates — the downloader falls back to the next URL on
  // HTTP/network failure (never on CRC mismatch: bad source, user decides).
  downloadUrls: z.array(z.string().url()).min(1),
  // The fetched bytes are a ZIP wrapping the ROM (restricted re-zipped
  // collections) — the downloader extracts the single entry before validating.
  extractFromZip: z.boolean().default(false),
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
  z.object({ type: z.literal('cancelled') }),
  z.object({ type: z.literal('complete') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type DownloadEvent = z.infer<typeof downloadEventSchema>;
