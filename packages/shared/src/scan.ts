import { z } from 'zod';

export const scanRequestSchema = z.object({
  datId: z.string().min(1),
  directory: z.string().min(1),
});

export const scanJobSchema = z.object({
  jobId: z.string(),
});
export type ScanJob = z.infer<typeof scanJobSchema>;

const scanMatchSchema = z.object({
  filePath: z.string(),
  gameName: z.string(),
  romName: z.string(),
  crc: z.string(),
});
export type ScanMatch = z.infer<typeof scanMatchSchema>;

const wrongNameEntrySchema = z.object({
  filePath: z.string(),
  currentName: z.string(),
  canonicalName: z.string(),
  crc: z.string(),
  gameName: z.string(),
});
export type WrongNameEntry = z.infer<typeof wrongNameEntrySchema>;

const scanResultSchema = z.object({
  matched: z.array(scanMatchSchema),
  wrongName: z.array(wrongNameEntrySchema),
  unmatched: z.array(z.string()),
});
export type ScanResult = z.infer<typeof scanResultSchema>;

export const scanEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), scanned: z.number(), total: z.number() }),
  z.object({ type: z.literal('done'), result: scanResultSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ScanEvent = z.infer<typeof scanEventSchema>;

const renameEntrySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

// No client-supplied root: the server validates every path against the
// configured system paths (settings), per the fs-safety rules in ARCHITECTURE.md.
export const renameRequestSchema = z.object({
  renames: z.array(renameEntrySchema).min(1),
});
export type RenameRequest = z.infer<typeof renameRequestSchema>;

export const renameResultSchema = z.object({
  done: z.array(renameEntrySchema),
  failed: z.array(z.object({ entry: renameEntrySchema, error: z.string() })),
  // Entries undone by the best-effort rollback after a failure — always
  // empty when failed.length === 0.
  rolledBack: z.array(z.string()),
});
export type RenameResult = z.infer<typeof renameResultSchema>;
