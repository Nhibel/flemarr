import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import DatabaseConstructor, { type Database } from 'better-sqlite3';
import { applyMigrations } from '@/lib/migrations.js';

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;
  const dataDir = join(homedir(), '.rom-curator');
  mkdirSync(dataDir, { recursive: true });
  _db = new DatabaseConstructor(join(dataDir, 'rom-curator.db'));
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
