import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import DatabaseConstructor, { type Database } from 'better-sqlite3';
import { applyMigrations } from '@/lib/migrations.js';

const DATA_DIR = join(homedir(), '.rom-curator');
const DB_PATH = join(DATA_DIR, 'rom-curator.db');

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;
  mkdirSync(DATA_DIR, { recursive: true });
  _db = new DatabaseConstructor(DB_PATH);
  applyMigrations(_db);
  return _db;
}

export function createDb(path: string): Database {
  const db = new DatabaseConstructor(path);
  applyMigrations(db);
  return db;
}
