import type { Database } from 'better-sqlite3';
import { getDb } from '@/lib/db.js';

export interface GameDetailsRow {
  gameId: string;
  provider: string;
  boxartUrl: string | null;
  /** False = the boxart was never probed (or its negative entry expired). */
  boxartKnown: boolean;
}

interface DbRow {
  game_id: string;
  provider: string;
  boxart_url: string | null;
  fetched_at: number;
}

// Negative cache TTL: misses older than this get re-probed.
export const MISS_TTL_S = 30 * 24 * 60 * 60;

function rowToDetails(row: DbRow, now: number): GameDetailsRow {
  const boxartMissExpired = row.boxart_url === null && now - row.fetched_at > MISS_TTL_S;
  return {
    gameId: row.game_id,
    provider: row.provider,
    boxartUrl: row.boxart_url,
    boxartKnown: !boxartMissExpired,
  };
}

export function getCachedDetails(
  datId: string,
  gameIds: string[],
  db: Database = getDb(),
): Map<string, GameDetailsRow> {
  if (gameIds.length === 0) return new Map();
  const placeholders = gameIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM game_details WHERE dat_id = ? AND game_id IN (${placeholders})`)
    .all(datId, ...gameIds) as DbRow[];

  const now = Math.floor(Date.now() / 1000);
  return new Map(rows.map((row) => [row.game_id, rowToDetails(row, now)]));
}

/** Boxart probe results. */
export function upsertDetails(
  datId: string,
  entries: Array<{ gameId: string; provider: string; boxartUrl: string | null }>,
  db: Database = getDb(),
): void {
  const stmt = db.prepare(
    `INSERT INTO game_details (dat_id, game_id, provider, boxart_url, fetched_at)
     VALUES (?, ?, ?, ?, unixepoch())
     ON CONFLICT(dat_id, game_id) DO UPDATE SET
       provider = excluded.provider,
       boxart_url = excluded.boxart_url,
       fetched_at = excluded.fetched_at`,
  );
  const insertAll = db.transaction(() => {
    for (const e of entries) stmt.run(datId, e.gameId, e.provider, e.boxartUrl);
  });
  insertAll();
}
