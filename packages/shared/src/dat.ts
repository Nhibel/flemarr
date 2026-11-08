import { z } from 'zod';

export const romSchema = z.object({
  name: z.string(),
  size: z.number().int().nonnegative(),
  // Absent for a nodump ROM — there's no known-good dump to checksum.
  // Skipped everywhere CRC matching/resolving happens, but the ROM (and its
  // game) still parses and stays visible in the UI (docs/dat-format.md).
  crc: z
    .string()
    .length(8)
    .regex(/^[0-9a-f]{8}$/)
    .optional(),
  md5: z
    .string()
    .length(32)
    .regex(/^[0-9a-f]{32}$/)
    .optional(),
  sha1: z
    .string()
    .length(40)
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  status: z.enum(['good', 'nodump']).default('good'),
});

export type Rom = z.infer<typeof romSchema>;

export const gameSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  region: z.array(z.string()),
  languages: z.array(z.string()),
  category: z.string().optional(),
  roms: z.array(romSchema).min(1),
});

export type Game = z.infer<typeof gameSchema>;

export const datFileSchema = z.object({
  source: z.enum(['no-intro', 'redump']),
  system: z.string(),
  version: z.string().optional(),
  date: z.string().optional(),
  games: z.array(gameSchema),
});

export type DatFile = z.infer<typeof datFileSchema>;

export const datSummarySchema = z.object({
  id: z.string(),
  system: z.string(),
  gameCount: z.number().int().nonnegative(),
  source: z.enum(['no-intro', 'redump']),
});

export type DatSummary = z.infer<typeof datSummarySchema>;
