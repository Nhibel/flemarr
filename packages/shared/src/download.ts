import { z } from 'zod';

export const downloadItemSchema = z.object({
  gameId: z.string().min(1),
  romName: z.string().min(1),
  expectedCrc: z.string().length(8),
  // Ordered candidates — the downloader falls back to the next URL on
  // HTTP/network failure (never on CRC mismatch: bad source, user decides).
  downloadUrls: z.array(z.string().url()).min(1),
});
export type DownloadItem = z.infer<typeof downloadItemSchema>;

export const downloadRequestSchema = z.object({
  datId: z.string().min(1),
  items: z.array(downloadItemSchema).min(1),
  destinationDir: z.string().min(1),
});
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;

export const downloadJobSchema = z.object({
  jobId: z.string(),
});
export type DownloadJob = z.infer<typeof downloadJobSchema>;

export const downloadEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    gameId: z.string(),
    bytesDownloaded: z.number(),
    totalBytes: z.number(),
  }),
  z.object({
    type: z.literal('file-done'),
    gameId: z.string(),
    romName: z.string(),
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
