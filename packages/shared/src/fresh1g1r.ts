import { z } from 'zod';
import { datSummarySchema } from './dat.js';

export const fresh1g1rPresetSchema = z.enum(['PropeR', 'McLean', 'Hearto']);
export type Fresh1g1rPreset = z.infer<typeof fresh1g1rPresetSchema>;

export const datSourceEntrySchema = z.object({
  name: z.string(),
  system: z.string(),
  path: z.string(),
  sha: z.string(),
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
  sha: z.string().min(1),
});
export type FetchDatRequest = z.infer<typeof fetchDatRequestSchema>;

export const fetchDatResponseSchema = datSummarySchema;
export type FetchDatResponse = z.infer<typeof fetchDatResponseSchema>;
