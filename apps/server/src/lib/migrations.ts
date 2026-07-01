import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILES = ['001_initial.sql'];

export function applyMigrations(db: Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(join(__dirname, 'migrations', file), 'utf8');
    db.exec(sql);
  }
}
