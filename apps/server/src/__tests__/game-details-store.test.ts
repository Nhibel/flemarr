import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createDb } from '../lib/db.js';
import {
  getCachedDetails,
  upsertDetails,
  upsertInfo,
  MISS_TTL_S,
} from '../services/game-details/store.js';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
});

const DAT = 'dat-1';

const INFO = {
  gameId: 'g1',
  year: 1994,
  genre: 'Platformer',
  publisher: 'Nintendo',
  descriptionFr: 'Un plombier saute.',
  descriptionEn: 'A plumber jumps.',
};

describe('boxart cache', () => {
  it('round-trips found and missing boxarts', () => {
    upsertDetails(
      DAT,
      [
        { gameId: 'g1', provider: 'libretro-thumbnails', boxartUrl: 'https://x/1.png' },
        { gameId: 'g2', provider: 'libretro-thumbnails', boxartUrl: null },
      ],
      db,
    );

    const cached = getCachedDetails(DAT, ['g1', 'g2', 'g3'], db);
    expect(cached.get('g1')?.boxartUrl).toBe('https://x/1.png');
    expect(cached.get('g1')?.boxartKnown).toBe(true);
    expect(cached.get('g2')?.boxartUrl).toBeNull();
    expect(cached.get('g2')?.boxartKnown).toBe(true); // known miss
    expect(cached.has('g3')).toBe(false);
  });

  it('is scoped by datId', () => {
    upsertDetails(DAT, [{ gameId: 'g1', provider: 'p', boxartUrl: 'https://x/1.png' }], db);
    expect(getCachedDetails('other-dat', ['g1'], db).has('g1')).toBe(false);
  });

  it('upsert overwrites a previous entry', () => {
    upsertDetails(DAT, [{ gameId: 'g1', provider: 'p', boxartUrl: null }], db);
    upsertDetails(DAT, [{ gameId: 'g1', provider: 'p', boxartUrl: 'https://x/1.png' }], db);
    expect(getCachedDetails(DAT, ['g1'], db).get('g1')?.boxartUrl).toBe('https://x/1.png');
  });

  it('expires negative entries after the miss TTL, keeps positive ones', () => {
    upsertDetails(
      DAT,
      [
        { gameId: 'hit', provider: 'p', boxartUrl: 'https://x/1.png' },
        { gameId: 'miss', provider: 'p', boxartUrl: null },
      ],
      db,
    );
    const past = Math.floor(Date.now() / 1000) - MISS_TTL_S - 60;
    db.prepare('UPDATE game_details SET fetched_at = ?').run(past);

    const cached = getCachedDetails(DAT, ['hit', 'miss'], db);
    expect(cached.get('hit')?.boxartKnown).toBe(true);
    expect(cached.get('miss')?.boxartKnown).toBe(false); // stale miss → re-probe
  });
});

describe('game info cache', () => {
  it('round-trips info and reports it known', () => {
    upsertInfo(DAT, [INFO], db);
    const row = getCachedDetails(DAT, ['g1'], db).get('g1');
    expect(row?.infoKnown).toBe(true);
    expect(row?.year).toBe(1994);
    expect(row?.descriptionFr).toBe('Un plombier saute.');
    expect(row?.descriptionEn).toBe('A plumber jumps.');
  });

  it('an info-first row does not read as a probed boxart', () => {
    upsertInfo(DAT, [INFO], db);
    const row = getCachedDetails(DAT, ['g1'], db).get('g1');
    expect(row?.boxartKnown).toBe(false); // boxart still needs its probe
    expect(row?.infoKnown).toBe(true);
  });

  it('info upsert preserves an existing boxart, and vice versa', () => {
    upsertDetails(DAT, [{ gameId: 'g1', provider: 'p', boxartUrl: 'https://x/1.png' }], db);
    upsertInfo(DAT, [INFO], db);
    let row = getCachedDetails(DAT, ['g1'], db).get('g1');
    expect(row?.boxartUrl).toBe('https://x/1.png');
    expect(row?.boxartKnown).toBe(true);
    expect(row?.infoKnown).toBe(true);

    upsertDetails(DAT, [{ gameId: 'g1', provider: 'p', boxartUrl: null }], db);
    row = getCachedDetails(DAT, ['g1'], db).get('g1');
    expect(row?.year).toBe(1994); // info survived the boxart update
  });

  it('info is unknown until fetched, and an all-null miss expires after the TTL', () => {
    upsertDetails(DAT, [{ gameId: 'g1', provider: 'p', boxartUrl: null }], db);
    let row = getCachedDetails(DAT, ['g1'], db).get('g1');
    expect(row?.infoKnown).toBe(false);

    // known miss: ScreenScraper was asked and had nothing
    upsertInfo(
      DAT,
      [
        {
          gameId: 'g1',
          year: null,
          genre: null,
          publisher: null,
          descriptionFr: null,
          descriptionEn: null,
        },
      ],
      db,
    );
    row = getCachedDetails(DAT, ['g1'], db).get('g1');
    expect(row?.infoKnown).toBe(true);

    const past = Math.floor(Date.now() / 1000) - MISS_TTL_S - 60;
    db.prepare('UPDATE game_details SET info_fetched_at = ?').run(past);
    row = getCachedDetails(DAT, ['g1'], db).get('g1');
    expect(row?.infoKnown).toBe(false); // stale info miss → re-ask
  });
});
