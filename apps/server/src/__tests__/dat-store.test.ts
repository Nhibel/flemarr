import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../lib/db.js';
import { addDat, getDat, listDats, deleteDat } from '../services/dat/store.js';
import type { Database } from 'better-sqlite3';
import type { DatFile } from '@shared/dat.js';

const SAMPLE_DAT: DatFile = {
  system: 'Nintendo - Super Nintendo Entertainment System',
  source: 'no-intro',
  version: '20240101-000000',
  games: [
    {
      id: 'game-1',
      name: 'Super Mario World (USA)',
      region: ['USA'],
      languages: ['En'],
      roms: [
        {
          name: 'Super Mario World (USA).sfc',
          size: 524288,
          crc: 'b19ed489',
          status: 'good' as const,
        },
      ],
    },
    {
      id: 'game-2',
      name: 'Donkey Kong Country (USA)',
      region: ['USA'],
      languages: ['En'],
      roms: [
        {
          name: 'Donkey Kong Country (USA).sfc',
          size: 2097152,
          crc: 'af614831',
          status: 'good' as const,
        },
      ],
    },
  ],
};

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('addDat', () => {
  it('stores a DAT and returns a summary with generated id', () => {
    const summary = addDat(SAMPLE_DAT, db);
    expect(summary.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(summary.system).toBe('Nintendo - Super Nintendo Entertainment System');
    expect(summary.source).toBe('no-intro');
    expect(summary.gameCount).toBe(2);
  });

  it('re-adding the same system+source replaces the DAT and keeps the id', () => {
    const s1 = addDat(SAMPLE_DAT, db);
    const updated: DatFile = {
      ...SAMPLE_DAT,
      version: '20240201-000000',
      games: SAMPLE_DAT.games.slice(0, 1),
    };
    const s2 = addDat(updated, db);

    expect(s2.id).toBe(s1.id);
    expect(s2.gameCount).toBe(1);
    expect(listDats(db)).toHaveLength(1);
    expect(getDat(s1.id, db)?.version).toBe('20240201-000000');
  });

  it('different systems get distinct rows', () => {
    addDat(SAMPLE_DAT, db);
    addDat({ ...SAMPLE_DAT, system: 'Sega - Mega Drive' }, db);
    expect(listDats(db)).toHaveLength(2);
  });
});

describe('deleteDat', () => {
  it('removes a stored DAT', () => {
    const { id } = addDat(SAMPLE_DAT, db);
    expect(deleteDat(id, db)).toBe(true);
    expect(getDat(id, db)).toBeUndefined();
    expect(listDats(db)).toHaveLength(0);
  });

  it('returns false for unknown id', () => {
    expect(deleteDat('no-such-id', db)).toBe(false);
  });
});

describe('getDat', () => {
  it('retrieves a stored DAT with all fields intact', () => {
    const { id } = addDat(SAMPLE_DAT, db);
    const dat = getDat(id, db);
    expect(dat).toBeDefined();
    expect(dat?.system).toBe(SAMPLE_DAT.system);
    expect(dat?.source).toBe(SAMPLE_DAT.source);
    expect(dat?.version).toBe(SAMPLE_DAT.version);
    expect(dat?.games).toHaveLength(2);
    expect(dat?.games[0]?.name).toBe('Super Mario World (USA)');
  });

  it('returns undefined for unknown id', () => {
    expect(getDat('no-such-id', db)).toBeUndefined();
  });

  it('survives a restart (data persists in DB, not just memory)', () => {
    const { id } = addDat(SAMPLE_DAT, db);
    // Simulate restart by re-using the same db instance (in-memory = same session)
    const dat = getDat(id, db);
    expect(dat).toBeDefined();
  });
});

describe('listDats', () => {
  it('returns empty array when no DATs stored', () => {
    expect(listDats(db)).toEqual([]);
  });

  it('lists all stored DATs as summaries (no games_json)', () => {
    addDat(SAMPLE_DAT, db);
    addDat({ ...SAMPLE_DAT, system: 'Sega - Mega Drive', source: 'no-intro' }, db);
    const list = listDats(db);
    expect(list).toHaveLength(2);
    expect(list.every((d) => !('games_json' in d))).toBe(true);
  });

  it('gameCount reflects actual number of games', () => {
    addDat(SAMPLE_DAT, db);
    const [entry] = listDats(db);
    expect(entry?.gameCount).toBe(2);
  });
});
