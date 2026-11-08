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
  // ScreenScraper.fr API credentials (user account + approved developer id) —
  // unlock game info (description/year/genre). Write-only like the above.
  screenScraperSsid: z.string().default(''),
  screenScraperSsPassword: z.string().default(''),
  screenScraperDevId: z.string().default(''),
  screenScraperDevPassword: z.string().default(''),
  // Language served for game descriptions (both are stored on every fetch).
  descriptionLanguage: z.enum(['fr', 'en']).default('fr'),
  // Where resolved downloads go for the whole session — picked once here
  // rather than per-download, since mixing targets in one session has no
  // real use case (see ResolvePanel, which reads this instead of offering
  // two buttons).
  downloadTarget: z.enum(['server', 'browser']).default('server'),
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
  screenScraperConfigured: z.boolean(),
  descriptionLanguage: z.enum(['fr', 'en']),
  downloadTarget: z.enum(['server', 'browser']),
  // The library root (ROMS_ROOT) the UI confines directory browsing to, or
  // null when unset (local dev, browse anywhere).
  romsRoot: z.string().nullable(),
});
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
