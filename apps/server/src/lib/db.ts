import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import DatabaseConstructor, { type Database } from 'better-sqlite3';
import { applyMigrations } from '@/lib/migrations.js';
import {
  DATA_DIR_ENV,
  DB_FILE_NAME,
  migrateLegacyDataDir,
  resolveDataDir,
} from '@/lib/data-dir.js';

let _db: Database | null = null;
let _dataDir: string | null = null;

/**
 * Every path under the data dir goes through here, so the first call is
 * where an install from before the rename is moved into place — before
 * anything (the DAT cache included) creates the new dir and makes the old
 * one look like it was never there.
 */
export function dataDir(): string {
  if (_dataDir !== null) return _dataDir;

  const home = homedir();
  const resolved = resolveDataDir(process.env, home);
  if (resolved.usedLegacyEnv) {
    console.warn(`ROM_CURATOR_DATA_DIR is deprecated, set ${DATA_DIR_ENV} instead`);
  }
  for (const move of migrateLegacyDataDir(resolved, home)) {
    console.log(`  migrated:  ${move}`);
  }

  _dataDir = resolved.dir;
  return _dataDir;
}

export function getDb(): Database {
  if (_db) return _db;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  _db = new DatabaseConstructor(join(dir, DB_FILE_NAME));
  applyMigrations(_db);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function createDb(path: string): Database {
  const db = new DatabaseConstructor(path);
  applyMigrations(db);
  return db;
}
