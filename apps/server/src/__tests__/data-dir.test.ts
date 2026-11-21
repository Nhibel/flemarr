import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateLegacyDataDir, resolveDataDir } from '@/lib/data-dir.js';

describe('resolveDataDir', () => {
  it('prefers FLEMARR_DATA_DIR', () => {
    const resolved = resolveDataDir(
      { FLEMARR_DATA_DIR: '/new', ROM_CURATOR_DATA_DIR: '/old' },
      '/home/u',
    );
    expect(resolved).toEqual({ dir: '/new', isDefault: false, usedLegacyEnv: false });
  });

  it('falls back to the pre-rename variable and flags it', () => {
    const resolved = resolveDataDir({ ROM_CURATOR_DATA_DIR: '/old' }, '/home/u');
    expect(resolved).toEqual({ dir: '/old', isDefault: false, usedLegacyEnv: true });
  });

  it('defaults to ~/.flemarr', () => {
    const resolved = resolveDataDir({}, '/home/u');
    expect(resolved).toEqual({
      dir: join('/home/u', '.flemarr'),
      isDefault: true,
      usedLegacyEnv: false,
    });
  });
});

describe('migrateLegacyDataDir', () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'flemarr-data-dir-test-'));
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('moves the default ~/.rom-curator dir and renames the database with its sidecars', () => {
    const legacyDir = join(home, '.rom-curator');
    mkdirSync(join(legacyDir, 'cache'), { recursive: true });
    writeFileSync(join(legacyDir, 'rom-curator.db'), 'db');
    writeFileSync(join(legacyDir, 'rom-curator.db-wal'), 'wal');

    const moves = migrateLegacyDataDir(resolveDataDir({}, home), home);

    const dir = join(home, '.flemarr');
    expect(existsSync(legacyDir)).toBe(false);
    expect(existsSync(join(dir, 'cache'))).toBe(true);
    expect(readFileSync(join(dir, 'flemarr.db'), 'utf8')).toBe('db');
    expect(readFileSync(join(dir, 'flemarr.db-wal'), 'utf8')).toBe('wal');
    expect(moves).toHaveLength(3);
  });

  it('renames the database inside a configured dir (the Docker /data case)', () => {
    const dir = join(home, 'data');
    mkdirSync(dir);
    writeFileSync(join(dir, 'rom-curator.db'), 'db');

    migrateLegacyDataDir(resolveDataDir({ FLEMARR_DATA_DIR: dir }, home), home);

    expect(readFileSync(join(dir, 'flemarr.db'), 'utf8')).toBe('db');
    expect(existsSync(join(dir, 'rom-curator.db'))).toBe(false);
  });

  it('never overwrites a database that already has the new name', () => {
    const dir = join(home, 'data');
    mkdirSync(dir);
    writeFileSync(join(dir, 'rom-curator.db'), 'old');
    writeFileSync(join(dir, 'flemarr.db'), 'new');

    const moves = migrateLegacyDataDir(resolveDataDir({ FLEMARR_DATA_DIR: dir }, home), home);

    expect(moves).toEqual([]);
    expect(readFileSync(join(dir, 'flemarr.db'), 'utf8')).toBe('new');
    expect(existsSync(join(dir, 'rom-curator.db'))).toBe(true);
  });

  it('does nothing on a fresh install', () => {
    expect(migrateLegacyDataDir(resolveDataDir({}, home), home)).toEqual([]);
    expect(existsSync(join(home, '.flemarr'))).toBe(false);
  });
});
