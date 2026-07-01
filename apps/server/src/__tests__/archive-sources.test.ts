import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../lib/db.js';
import {
  getSources,
  getAllSystems,
  addSource,
  removeSource,
  findSystemForIdentifier,
} from '../services/archive-org/sources.js';
import type { Database } from 'better-sqlite3';
import type { ArchiveSource } from '@shared/archive.js';

const SNES = 'Nintendo - Super Nintendo Entertainment System';
const PS1 = 'Sony - PlayStation';

const SRC_A: ArchiveSource = { identifier: 'snes-roms-archive', layout: 'direct', note: '' };
const SRC_B: ArchiveSource = {
  identifier: 'snes-collection-zip',
  layout: 'zip-collection',
  note: 'big zip',
};
const SRC_C: ArchiveSource = { identifier: 'ps1-roms', layout: 'direct', note: '' };

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('addSource / getSources', () => {
  it('stores a source and retrieves it by system', () => {
    addSource(SNES, SRC_A, db);
    expect(getSources(SNES, db)).toEqual([SRC_A]);
  });

  it('ignores duplicate identifiers (INSERT OR IGNORE)', () => {
    addSource(SNES, SRC_A, db);
    addSource(SNES, SRC_A, db);
    expect(getSources(SNES, db)).toHaveLength(1);
  });

  it('returns empty array for unknown system', () => {
    expect(getSources('Unknown System', db)).toEqual([]);
  });

  it('stores multiple sources for same system', () => {
    addSource(SNES, SRC_A, db);
    addSource(SNES, SRC_B, db);
    const sources = getSources(SNES, db);
    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.identifier)).toContain('snes-roms-archive');
    expect(sources.map((s) => s.identifier)).toContain('snes-collection-zip');
  });
});

describe('getAllSystems', () => {
  it('returns empty array when no sources', () => {
    expect(getAllSystems(db)).toEqual([]);
  });

  it('returns distinct systems sorted alphabetically', () => {
    addSource(SNES, SRC_A, db);
    addSource(PS1, SRC_C, db);
    addSource(SNES, SRC_B, db);
    expect(getAllSystems(db)).toEqual([SNES, PS1]); // Nintendo < Sony alphabetically
  });
});

describe('removeSource', () => {
  it('removes a source by identifier and returns true', () => {
    addSource(SNES, SRC_A, db);
    expect(removeSource(SRC_A.identifier, db)).toBe(true);
    expect(getSources(SNES, db)).toEqual([]);
  });

  it('returns false when identifier does not exist', () => {
    expect(removeSource('nonexistent', db)).toBe(false);
  });

  it('removes the correct source when multiple exist', () => {
    addSource(SNES, SRC_A, db);
    addSource(SNES, SRC_B, db);
    removeSource(SRC_A.identifier, db);
    expect(getSources(SNES, db)).toEqual([SRC_B]);
  });
});

describe('findSystemForIdentifier', () => {
  it('returns the system for a known identifier', () => {
    addSource(SNES, SRC_A, db);
    expect(findSystemForIdentifier(SRC_A.identifier, db)).toBe(SNES);
  });

  it('returns undefined for unknown identifier', () => {
    expect(findSystemForIdentifier('no-such-id', db)).toBeUndefined();
  });
});
