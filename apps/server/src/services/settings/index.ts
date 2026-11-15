import type { Database } from 'better-sqlite3';
import type { Settings, SettingsResponse, UpdateSettings } from '@shared/settings.js';
import { settingsSchema } from '@shared/settings.js';
import { getDb } from '@/lib/db.js';

const DEFAULTS: Settings = settingsSchema.parse({});

function readScalars(db: Database): {
  fresh1g1rPreset: string;
  downloaderConcurrency: number;
  archiveOrgAccessKey: string;
  archiveOrgSecretKey: string;
  archiveOrgLoggedInUser: string;
  archiveOrgLoggedInSig: string;
  downloadTarget: string;
  topology: string | null;
  autoConvertChd: boolean;
} {
  const rows = db
    .prepare(
      `SELECT key, value FROM settings WHERE key IN
       ('fresh1g1r_preset', 'downloader_concurrency', 'archive_org_access_key',
        'archive_org_secret_key', 'archive_org_logged_in_user', 'archive_org_logged_in_sig',
        'download_target', 'topology', 'auto_convert_chd')`,
    )
    .all() as { key: string; value: string }[];

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    fresh1g1rPreset: map['fresh1g1r_preset'] ?? DEFAULTS.fresh1g1rPreset,
    downloaderConcurrency: map['downloader_concurrency']
      ? Number(map['downloader_concurrency'])
      : DEFAULTS.downloaderConcurrency,
    archiveOrgAccessKey: map['archive_org_access_key'] ?? '',
    archiveOrgSecretKey: map['archive_org_secret_key'] ?? '',
    archiveOrgLoggedInUser: map['archive_org_logged_in_user'] ?? '',
    archiveOrgLoggedInSig: map['archive_org_logged_in_sig'] ?? '',
    downloadTarget: map['download_target'] ?? DEFAULTS.downloadTarget,
    // No row at all means the install question was never answered, which
    // is what null stands for — distinct from any of the three answers.
    topology: map['topology'] ?? null,
    autoConvertChd: map['auto_convert_chd'] === '1',
  };
}

function readSystemPaths(db: Database): Record<string, string> {
  const rows = db.prepare(`SELECT system, path FROM system_paths ORDER BY system`).all() as {
    system: string;
    path: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.system, r.path]));
}

export function getSettings(db: Database = getDb()): Settings {
  const scalars = readScalars(db);
  const systemPaths = readSystemPaths(db);
  return settingsSchema.parse({
    fresh1g1rPreset: scalars.fresh1g1rPreset,
    downloaderConcurrency: scalars.downloaderConcurrency,
    systemPaths,
    archiveOrgAccessKey: scalars.archiveOrgAccessKey,
    archiveOrgSecretKey: scalars.archiveOrgSecretKey,
    archiveOrgLoggedInUser: scalars.archiveOrgLoggedInUser,
    archiveOrgLoggedInSig: scalars.archiveOrgLoggedInSig,
    downloadTarget: scalars.downloadTarget,
    topology: scalars.topology,
    autoConvertChd: scalars.autoConvertChd,
  });
}

/**
 * The view the API exposes: the archive.org credentials are write-only and
 * never leave the server — the client only gets configured/not-configured.
 */
export function toSettingsResponse(s: Settings, romsRoot: string | null): SettingsResponse {
  return {
    fresh1g1rPreset: s.fresh1g1rPreset,
    downloaderConcurrency: s.downloaderConcurrency,
    systemPaths: s.systemPaths,
    archiveOrgKeysConfigured: s.archiveOrgAccessKey !== '' && s.archiveOrgSecretKey !== '',
    archiveOrgSessionConfigured: s.archiveOrgLoggedInUser !== '' && s.archiveOrgLoggedInSig !== '',
    downloadTarget: s.downloadTarget,
    topology: s.topology,
    autoConvertChd: s.autoConvertChd,
    romsRoot,
  };
}

export function updateSettings(patch: UpdateSettings, db: Database = getDb()): Settings {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );

  if (patch.fresh1g1rPreset !== undefined) {
    upsert.run('fresh1g1r_preset', patch.fresh1g1rPreset);
  }
  if (patch.downloaderConcurrency !== undefined) {
    upsert.run('downloader_concurrency', String(patch.downloaderConcurrency));
  }
  if (patch.archiveOrgAccessKey !== undefined) {
    upsert.run('archive_org_access_key', patch.archiveOrgAccessKey);
  }
  if (patch.archiveOrgSecretKey !== undefined) {
    upsert.run('archive_org_secret_key', patch.archiveOrgSecretKey);
  }
  if (patch.archiveOrgLoggedInUser !== undefined) {
    upsert.run('archive_org_logged_in_user', patch.archiveOrgLoggedInUser);
  }
  if (patch.archiveOrgLoggedInSig !== undefined) {
    upsert.run('archive_org_logged_in_sig', patch.archiveOrgLoggedInSig);
  }
  if (patch.downloadTarget !== undefined) {
    upsert.run('download_target', patch.downloadTarget);
  }
  // null is a meaningful value here (never answered), so it has to be
  // written as a row deletion rather than skipped like an absent key —
  // otherwise the install question could never be reset.
  if (patch.topology !== undefined) {
    if (patch.topology === null) {
      db.prepare(`DELETE FROM settings WHERE key = 'topology'`).run();
    } else {
      upsert.run('topology', patch.topology);
    }
  }
  if (patch.autoConvertChd !== undefined) {
    upsert.run('auto_convert_chd', patch.autoConvertChd ? '1' : '0');
  }
  if (patch.systemPaths !== undefined) {
    const upsertPath = db.prepare(
      `INSERT INTO system_paths (system, path) VALUES (?, ?) ON CONFLICT(system) DO UPDATE SET path = excluded.path`,
    );
    const deletePath = db.prepare(`DELETE FROM system_paths WHERE system = ?`);
    for (const [system, path] of Object.entries(patch.systemPaths)) {
      if (path === '') {
        deletePath.run(system);
      } else {
        upsertPath.run(system, path);
      }
    }
  }

  return getSettings(db);
}
