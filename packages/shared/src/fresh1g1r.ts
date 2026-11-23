import { z } from 'zod';
import { datSummarySchema } from './dat.js';

export const fresh1g1rPresetSchema = z.enum(['PropeR', 'McLean', 'Hearto']);
export type Fresh1g1rPreset = z.infer<typeof fresh1g1rPresetSchema>;

const datSourceEntrySchema = z.object({
  name: z.string(),
  system: z.string(),
  path: z.string(),
  revision: z.string(),
});
export type DatSourceEntry = z.infer<typeof datSourceEntrySchema>;

export const listSourcesResponseSchema = z.object({
  preset: fresh1g1rPresetSchema,
  sources: z.array(datSourceEntrySchema),
});
export type ListSourcesResponse = z.infer<typeof listSourcesResponseSchema>;

export const fetchDatRequestSchema = z.object({
  preset: fresh1g1rPresetSchema,
  path: z.string().min(1),
  // CRC32 and size — also used as cache filename, so the format must be strict
  // (an unconstrained string would allow path traversal in the cache dir).
  revision: z.string().regex(/^[0-9a-f]{8}-\d{1,12}$/),
});
export type FetchDatRequest = z.infer<typeof fetchDatRequestSchema>;

// A loaded DAT whose set has a newer version on Fresh1G1R. preset, path
// and revision are what POST /dats/from-fresh1g1r needs to load it.
const datUpdateSchema = fetchDatRequestSchema.extend({
  datId: z.string(),
  version: z.string(),
});
export type DatUpdate = z.infer<typeof datUpdateSchema>;

export const datUpdatesResponseSchema = z.object({
  updates: z.array(datUpdateSchema),
});

export const fetchDatResponseSchema = datSummarySchema;
