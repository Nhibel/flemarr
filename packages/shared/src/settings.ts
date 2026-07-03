import { z } from 'zod';
import { fresh1g1rPresetSchema } from './fresh1g1r.js';

export const settingsSchema = z.object({
  fresh1g1rPreset: fresh1g1rPresetSchema.default('PropeR'),
  downloaderConcurrency: z.number().int().min(1).max(8).default(2),
  systemPaths: z.record(z.string(), z.string()).default({}),
  // archive.org S3-like API keys (archive.org/account/s3.php) — unlock
  // downloads from access-restricted items. Empty = anonymous access.
  archiveOrgAccessKey: z.string().default(''),
  archiveOrgSecretKey: z.string().default(''),
  // Session cookies obtained via the xauthn login exchange — the datanodes
  // check these (not the S3 header) for restricted zip-view downloads.
  archiveOrgLoggedInUser: z.string().default(''),
  archiveOrgLoggedInSig: z.string().default(''),
});

export type Settings = z.infer<typeof settingsSchema>;

export const updateSettingsSchema = settingsSchema.partial();
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// What the settings API returns. The archive.org credentials are write-only:
// the values never leave the server — the client only learns whether they
// are configured.
export const settingsResponseSchema = z.object({
  fresh1g1rPreset: fresh1g1rPresetSchema,
  downloaderConcurrency: z.number().int().min(1).max(8),
  systemPaths: z.record(z.string(), z.string()),
  archiveOrgKeysConfigured: z.boolean(),
  archiveOrgSessionConfigured: z.boolean(),
  // The library root (ROMS_ROOT) the UI confines directory browsing to, or
  // null when unset (local dev, browse anywhere).
  romsRoot: z.string().nullable(),
});
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
