import { z } from 'zod';
import { fresh1g1rPresetSchema } from './fresh1g1r.js';

export const settingsSchema = z.object({
  fresh1g1rPreset: fresh1g1rPresetSchema.default('PropeR'),
  downloaderConcurrency: z.number().int().min(1).max(8).default(2),
  systemPaths: z.record(z.string(), z.string()).default({}),
});

export type Settings = z.infer<typeof settingsSchema>;

export const updateSettingsSchema = settingsSchema.partial();
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export const settingsResponseSchema = settingsSchema;
export type SettingsResponse = Settings;
