import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../lib/db.js';
import {
  getSources,
  getAllSystems,
  addSource,
  removeSource,
  setSourceSearched,
} from '../services/archive-org/sources.js';
import type { Database } from 'better-sqlite3';
import type { ArchiveSource, ConfiguredSource } from '@shared/archive.js';

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

/** A source as getSources returns it: searched unless switched off. */
function stored(source: ArchiveSource): ConfiguredSource {
  return { ...source, searched: true };
}

describe('addSource / getSources', () => {
  it('stores a source and retrieves it by system', () => {
    addSource(SNES, SRC_A, db);
    expect(getSources(SNES, db)).toEqual([stored(SRC_A)]);
  });

  it('adding the same pair twice keeps one row', () => {
    addSource(SNES, SRC_A, db);
    addSource(SNES, SRC_A, db);
    expect(getSources(SNES, db)).toHaveLength(1);
  });

  // The multi-system collections in known-sources.ts ("ni-roms" hosts every
  // No-Intro set) have to be registrable per system — the old identifier-only
  // primary key silently dropped every system after the first.
  it('stores the same identifier for several systems', () => {
    addSource(SNES, SRC_A, db);
    addSource(PS1, SRC_A, db);
    expect(getSources(SNES, db)).toEqual([stored(SRC_A)]);
    expect(getSources(PS1, db)).toEqual([stored(SRC_A)]);
  });

  it('re-adding a pair corrects its layout', () => {
    addSource(SNES, SRC_A, db);
    addSource(SNES, { ...SRC_A, layout: 'zip-collection' }, db);
    expect(getSources(SNES, db)).toEqual([stored({ ...SRC_A, layout: 'zip-collection' })]);
  });

  it('re-adding a pair with no note keeps the stored one', () => {
    addSource(SNES, { ...SRC_A, note: 'hand-written' }, db);
    addSource(SNES, { ...SRC_A, note: '' }, db);
    expect(getSources(SNES, db)[0]?.note).toBe('hand-written');
  });

  it('re-adding a pair overwrites the note when one is given', () => {
    addSource(SNES, { ...SRC_A, note: 'old' }, db);
    addSource(SNES, { ...SRC_A, note: 'new' }, db);
    expect(getSources(SNES, db)[0]?.note).toBe('new');
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
  it('removes a source and returns true', () => {
    addSource(SNES, SRC_A, db);
    expect(removeSource(SRC_A.identifier, SNES, db)).toBe(true);
    expect(getSources(SNES, db)).toEqual([]);
  });

  it('returns false when the identifier does not exist', () => {
    expect(removeSource('nonexistent', SNES, db)).toBe(false);
  });

  it('returns false when the identifier exists under another system', () => {
    addSource(SNES, SRC_A, db);
    expect(removeSource(SRC_A.identifier, PS1, db)).toBe(false);
    expect(getSources(SNES, db)).toEqual([stored(SRC_A)]);
  });

  it('removes the correct source when multiple exist', () => {
    addSource(SNES, SRC_A, db);
    addSource(SNES, SRC_B, db);
    removeSource(SRC_A.identifier, SNES, db);
    expect(getSources(SNES, db)).toEqual([stored(SRC_B)]);
  });

  // Dropping a multi-system collection from one system must leave the others
  // alone — the deletion is scoped to the (identifier, system) pair.
  it('leaves the same identifier registered for other systems', () => {
    addSource(SNES, SRC_A, db);
    addSource(PS1, SRC_A, db);
    removeSource(SRC_A.identifier, SNES, db);
    expect(getSources(SNES, db)).toEqual([]);
    expect(getSources(PS1, db)).toEqual([stored(SRC_A)]);
  });
});

describe('setSourceSearched', () => {
  it('switches a source off, then back on', () => {
    addSource(SNES, SRC_A, db);
    expect(setSourceSearched(SRC_A.identifier, SNES, false, db)).toBe(true);
    expect(getSources(SNES, db)[0]?.searched).toBe(false);
    setSourceSearched(SRC_A.identifier, SNES, true, db);
    expect(getSources(SNES, db)[0]?.searched).toBe(true);
  });

  it('only touches the given system', () => {
    addSource(SNES, SRC_A, db);
    addSource(PS1, SRC_A, db);
    setSourceSearched(SRC_A.identifier, SNES, false, db);
    expect(getSources(PS1, db)[0]?.searched).toBe(true);
  });

  // Re-adding corrects the layout; it must not switch the source back on.
  it('survives re-adding the same pair', () => {
    addSource(SNES, SRC_A, db);
    setSourceSearched(SRC_A.identifier, SNES, false, db);
    addSource(SNES, { ...SRC_A, layout: 'zip-collection' }, db);
    expect(getSources(SNES, db)[0]?.searched).toBe(false);
  });

  it('reports a pair that is not configured', () => {
    expect(setSourceSearched('nope', SNES, false, db)).toBe(false);
  });
});
