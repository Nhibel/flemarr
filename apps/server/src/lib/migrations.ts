import type { Database } from 'better-sqlite3';
import { migration001 } from './migrations/001-initial.js';
import { migration002 } from './migrations/002-game-details.js';
import { migration003 } from './migrations/003-game-info.js';
import { migration004 } from './migrations/004-remove-screenscraper-info.js';
import { migration005 } from './migrations/005-source-system-key.js';
import { migration006 } from './migrations/006-source-searched.js';
import { migration007 } from './migrations/007-retry-boxart-misses.js';

// Ordered, append-only. PRAGMA user_version records how many have been applied,
// so migrations run exactly once and don't need to stay idempotent forever.
const MIGRATIONS: string[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
];

export function applyMigrations(db: Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const applied = db.pragma('user_version', { simple: true }) as number;

  for (let i = applied; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i];
    if (sql === undefined) continue;
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
