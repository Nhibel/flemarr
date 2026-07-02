import { z } from 'zod';

export const downloadItemSchema = z.object({
  gameId: z.string().min(1),
  romName: z.string().min(1),
  expectedCrc: z.string().length(8),
  downloadUrl: z.string().url(),
});
export type DownloadItem = z.infer<typeof downloadItemSchema>;

export const downloadRequestSchema = z.object({
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
