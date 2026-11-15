import { z } from 'zod';

export const validateDirRequestSchema = z.object({
  path: z.string().min(1),
});
/**
 * `fileCount` counts files directly inside that directory, sub-directories
 * excluded — the install flow shows it so a folder can be recognised as
 * the right one without running a scan. It costs one extra `readdir` per
 * listed child, which is invisible on a local disk and perceptible on a
 * network mount; the listing already walked the parent, so the parent's own
 * count is free.
 */
const dirEntrySchema = z.object({
  path: z.string(),
  fileCount: z.number().int().nonnegative(),
});
export type DirEntry = z.infer<typeof dirEntrySchema>;

export const listDirsResponseSchema = z.object({
  listedPath: z.string(),
  parent: z.string().nullable(),
  dirs: z.array(dirEntrySchema),
  /** Files directly inside `listedPath` itself. */
  fileCount: z.number().int().nonnegative(),
});
export type ListDirsResponse = z.infer<typeof listDirsResponseSchema>;

export const createDirResponseSchema = z.object({
  path: z.string(),
});
export type CreateDirResponse = z.infer<typeof createDirResponseSchema>;
