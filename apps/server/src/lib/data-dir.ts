import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the database and the DAT/icon cache live, and the one-time move of
 * an install made under the app's previous name (rom-curator, renamed
 * Flemarr on 2026-11-21).
 *
 * The legacy names below are read only to migrate; drop them once every
 * install has started at least once since the rename.
 */
export const DATA_DIR_ENV = 'FLEMARR_DATA_DIR';
export const DB_FILE_NAME = 'flemarr.db';

const LEGACY_DATA_DIR_ENV = 'ROM_CURATOR_DATA_DIR';
const LEGACY_DB_FILE_NAME = 'rom-curator.db';
const DEFAULT_DIR_NAME = '.flemarr';
const LEGACY_DEFAULT_DIR_NAME = '.rom-curator';
// SQLite in WAL mode keeps two sidecar files that belong with the database.
const SQLITE_SIDECAR_SUFFIXES = ['', '-wal', '-shm'];

export interface ResolvedDataDir {
  dir: string;
  /** True when the dir came from the default under the home directory. */
  isDefault: boolean;
  /** True when only the pre-rename variable was set. */
  usedLegacyEnv: boolean;
}

/** Pure: picks the data dir from the environment, new variable first. */
export function resolveDataDir(
  env: Record<string, string | undefined>,
  home: string,
): ResolvedDataDir {
  const configured = env[DATA_DIR_ENV];
  if (configured) return { dir: configured, isDefault: false, usedLegacyEnv: false };

  const legacy = env[LEGACY_DATA_DIR_ENV];
  if (legacy) return { dir: legacy, isDefault: false, usedLegacyEnv: true };

  return { dir: join(home, DEFAULT_DIR_NAME), isDefault: true, usedLegacyEnv: false };
}

/**
 * Renames what an install made under the old name left behind, so it is
 * found under the new one: the default ~/.rom-curator dir, then the
 * database file and its WAL sidecars. Never overwrites: a target that
 * already exists is the newer data and wins. Returns a line per move, for
 * the startup log.
 */
export function migrateLegacyDataDir(resolved: ResolvedDataDir, home: string): string[] {
  const moves: string[] = [];

  if (resolved.isDefault) {
    const legacyDir = join(home, LEGACY_DEFAULT_DIR_NAME);
    if (!existsSync(resolved.dir) && existsSync(legacyDir)) {
      renameSync(legacyDir, resolved.dir);
      moves.push(`${legacyDir} -> ${resolved.dir}`);
    }
  }

  const legacyDb = join(resolved.dir, LEGACY_DB_FILE_NAME);
  const db = join(resolved.dir, DB_FILE_NAME);
  if (existsSync(db) || !existsSync(legacyDb)) return moves;

  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const from = legacyDb + suffix;
    if (!existsSync(from)) continue;
    renameSync(from, db + suffix);
    moves.push(`${from} -> ${db + suffix}`);
  }
  return moves;
}
