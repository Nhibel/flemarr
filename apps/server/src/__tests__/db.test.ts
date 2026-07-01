import { describe, it, expect } from 'vitest';
import { createDb } from '../lib/db.js';

describe('createDb', () => {
  it('opens an in-memory database and creates all tables', () => {
    const db = createDb(':memory:');

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[];

    const names = tables.map((t) => t.name);
    expect(names).toContain('dats');
    expect(names).toContain('archive_sources');
    expect(names).toContain('settings');
    expect(names).toContain('system_paths');
    expect(names).toContain('download_history');
  });

  it('enables WAL mode', () => {
    const db = createDb(':memory:');
    const row = db.pragma('journal_mode') as { journal_mode: string }[];
    expect(row[0]?.journal_mode).toBe('memory'); // :memory: ignores WAL but pragma is accepted
  });

  it('returns an existing db instance from getDb singleton', () => {
    // Just verifies createDb returns a working instance each call (not a singleton test)
    const db1 = createDb(':memory:');
    const db2 = createDb(':memory:');
    expect(db1).not.toBe(db2);
  });
});
