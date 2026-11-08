import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createDb } from '../lib/db.js';
import { getCachedDetails, upsertDetails, MISS_TTL_S } from '../services/game-details/store.js';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
});

const DAT = 'dat-1';

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
