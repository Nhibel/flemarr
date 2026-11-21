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
  // Where resolved downloads go for the whole session — picked once here
  // rather than per-download, since mixing targets in one session has no
  // real use case (see ResolvePanel, which reads this instead of offering
  // two buttons).
  downloadTarget: z.enum(['server', 'browser']).default('server'),
  // The answer to the install question "where do downloaded games land?",
  // asked first because it decides both where downloads go AND whether a
  // server-side scan can see anything at all:
  //
  //   local  — in a folder the server can read and write (a local disk, a
  //            Docker volume, a mounted network share); downloadTarget 'server'
  //   remote — in the browser's downloads; the server never sees the
  //            collection; downloadTarget 'browser'
  //
  // A third answer, `mounted`, was folded into `local` (migration010): it
  // meant the same thing to the code and only made the question harder.
  //
  // null means the question has never been answered — that is what gates
  // the install flow. downloadTarget stays the field every code path reads;
  // writing this one always writes downloadTarget with it, so there is never
  // a second control for the same decision.
  topology: z.enum(['local', 'remote']).nullable().default(null),
  // Server-target only: once every rom of a disc game (anything with a
  // .cue) finishes downloading, convert it to a single .chd and delete the
  // original .bin/.cue — smaller, tidier library for frontends like
  // EmuDeck that prefer one file per game. Verified round-trip (chdman
  // extractcd + CRC32 against the DAT) before the originals are deleted;
  // left untouched on any conversion failure.
  autoConvertChd: z.boolean().default(false),
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
  downloadTarget: z.enum(['server', 'browser']),
  topology: z.enum(['local', 'remote']).nullable(),
  autoConvertChd: z.boolean(),
  // The library root (ROMS_ROOT) the UI confines directory browsing to, or
  // null when unset (local dev, browse anywhere).
  romsRoot: z.string().nullable(),
});
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
