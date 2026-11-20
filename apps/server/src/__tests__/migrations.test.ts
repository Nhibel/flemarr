import { describe, it, expect } from 'vitest';
import DatabaseConstructor from 'better-sqlite3';
import { applyMigrations } from '../lib/migrations.js';

/**
 * The upgrade path matters as much as the fresh schema: the homelab deploys
 * onto a live database. These tests rebuild the pre-migration state by hand
 * and run the real migration list over it.
 */
describe('migration005 — (identifier, system) source key', () => {
  // The schema as migration001 created it, at the user_version that leaves
  // only migration005 to run.
  function legacyDb(): DatabaseConstructor.Database {
    const db = new DatabaseConstructor(':memory:');
    db.exec(`
      CREATE TABLE archive_sources (
        identifier TEXT PRIMARY KEY,
        system TEXT NOT NULL,
        layout TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT ''
      );
    `);
    db.pragma('user_version = 4');
    return db;
  }

  it('keeps existing rows', () => {
    const db = legacyDb();
    db.prepare(`INSERT INTO archive_sources VALUES (?, ?, ?, ?)`).run(
      'ni-roms',
      'Nintendo - Super Nintendo Entertainment System',
      'zip-collection',
      'No-Intro full sets',
    );

    applyMigrations(db);

    const rows = db.prepare(`SELECT * FROM archive_sources`).all();
    expect(rows).toEqual([
      {
        identifier: 'ni-roms',
        system: 'Nintendo - Super Nintendo Entertainment System',
        layout: 'zip-collection',
        note: 'No-Intro full sets',
        // Added by migration006, which runs after this one.
        searched: 1,
      },
    ]);
  });

  it('then accepts the same identifier for another system', () => {
    const db = legacyDb();
    db.prepare(
      `INSERT INTO archive_sources (identifier, system, layout, note) VALUES (?, ?, ?, ?)`,
    ).run('ni-roms', 'Nintendo - Super Nintendo Entertainment System', 'zip-collection', '');

    applyMigrations(db);

    db.prepare(
      `INSERT INTO archive_sources (identifier, system, layout, note) VALUES (?, ?, ?, ?)`,
    ).run('ni-roms', 'Nintendo - Nintendo Entertainment System', 'zip-collection', '');
    const count = db
      .prepare(`SELECT COUNT(*) AS n FROM archive_sources WHERE identifier = ?`)
      .get('ni-roms') as { n: number };
    expect(count.n).toBe(2);
  });

  it('still rejects a duplicate (identifier, system) pair', () => {
    const db = legacyDb();
    applyMigrations(db);

    const insert = db.prepare(
      `INSERT INTO archive_sources (identifier, system, layout, note) VALUES (?, ?, ?, ?)`,
    );
    insert.run('ni-roms', 'Sony - PlayStation', 'direct', '');
    expect(() => insert.run('ni-roms', 'Sony - PlayStation', 'direct', '')).toThrow();
  });

  it('keeps the system index', () => {
    const db = legacyDb();
    applyMigrations(db);

    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='archive_sources'`)
      .all() as { name: string }[];
    expect(indexes.map((i) => i.name)).toContain('idx_archive_sources_system');
  });

  it('is applied exactly once (user_version advances)', () => {
    const db = legacyDb();
    applyMigrations(db);
    const after = db.pragma('user_version', { simple: true });
    applyMigrations(db); // a second run must be a no-op, not a rebuild
    expect(db.pragma('user_version', { simple: true })).toBe(after);
  });
});

describe('migration006 — searched flag', () => {
  it('leaves every existing and new source searched', () => {
    const db = new DatabaseConstructor(':memory:');
    applyMigrations(db);
    db.prepare(
      `INSERT INTO archive_sources (identifier, system, layout, note) VALUES (?, ?, ?, ?)`,
    ).run('ni-roms', 'Nintendo - Super Nintendo Entertainment System', 'zip-collection', '');
    const row = db.prepare(`SELECT searched FROM archive_sources`).get() as { searched: number };
    expect(row.searched).toBe(1);
  });
});
