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
  // migration005 and the later ones to run. game_details, settings and dats are there
  // because migration007 and migration009 touch them.
  function legacyDb(): DatabaseConstructor.Database {
    const db = new DatabaseConstructor(':memory:');
    db.exec(`
      CREATE TABLE archive_sources (
        identifier TEXT PRIMARY KEY,
        system TEXT NOT NULL,
        layout TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE game_details (
        dat_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        boxart_url TEXT,
        fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (dat_id, game_id)
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE dats (
        id TEXT PRIMARY KEY,
        system TEXT NOT NULL,
        source TEXT NOT NULL,
        version TEXT,
        date TEXT,
        games_json TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
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

describe('migration007 — boxart misses re-probed', () => {
  it('drops the misses and keeps the hits', () => {
    const db = new DatabaseConstructor(':memory:');
    db.exec(`
      CREATE TABLE game_details (
        dat_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        boxart_url TEXT,
        fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (dat_id, game_id)
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE dats (
        id TEXT PRIMARY KEY,
        system TEXT NOT NULL,
        source TEXT NOT NULL,
        version TEXT,
        date TEXT,
        games_json TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    db.pragma('user_version = 6');
    const insert = db.prepare(
      `INSERT INTO game_details (dat_id, game_id, provider, boxart_url) VALUES (?, ?, ?, ?)`,
    );
    insert.run('d', 'hit', 'p', 'https://x/1.png');
    insert.run('d', 'miss', 'p', null);
    applyMigrations(db);
    const rows = db.prepare(`SELECT game_id FROM game_details`).all() as Array<{
      game_id: string;
    }>;
    expect(rows.map((row) => row.game_id)).toEqual(['hit']);
  });
});

describe('migration009 — DAT origin', () => {
  it('leaves existing DATs without an origin', () => {
    const db = new DatabaseConstructor(':memory:');
    applyMigrations(db);
    db.prepare(`INSERT INTO dats (id, system, source, games_json) VALUES (?, ?, ?, ?)`).run(
      'd1',
      'SNES',
      'no-intro',
      '[]',
    );
    const row = db.prepare(`SELECT fresh1g1r_preset, fresh1g1r_path FROM dats`).get();
    expect(row).toEqual({ fresh1g1r_preset: null, fresh1g1r_path: null });
  });
});

describe('migration010 — mounted topology folded into local', () => {
  // A database left at the version just before migration010, holding an
  // answer the settings schema no longer accepts.
  function dbBeforeMigration010(topology: string): DatabaseConstructor.Database {
    const db = new DatabaseConstructor(':memory:');
    applyMigrations(db);
    db.pragma('user_version = 9');
    const insert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
    insert.run('topology', topology);
    insert.run('download_target', 'server');
    return db;
  }

  function settingValue(db: DatabaseConstructor.Database, key: string): unknown {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
      { value: string } | undefined;
    return row?.value;
  }

  it('turns a recorded mounted answer into local', () => {
    const db = dbBeforeMigration010('mounted');
    applyMigrations(db);
    expect(settingValue(db, 'topology')).toBe('local');
    expect(settingValue(db, 'download_target')).toBe('server');
  });

  it('leaves the other answers alone', () => {
    const db = dbBeforeMigration010('remote');
    applyMigrations(db);
    expect(settingValue(db, 'topology')).toBe('remote');
  });
});
