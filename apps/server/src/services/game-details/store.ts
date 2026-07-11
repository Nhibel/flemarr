import type { Database } from 'better-sqlite3';
import { getDb } from '@/lib/db.js';

export interface GameDetailsRow {
  gameId: string;
  provider: string;
  boxartUrl: string | null;
  /** False = the boxart was never probed (or its negative entry expired). */
  boxartKnown: boolean;
  year: number | null;
  genre: string | null;
  publisher: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  /** False = ScreenScraper was never asked (or its negative entry expired). */
  infoKnown: boolean;
}

interface DbRow {
  game_id: string;
  provider: string;
  boxart_url: string | null;
  fetched_at: number;
  year: number | null;
  genre: string | null;
  publisher: string | null;
  description_fr: string | null;
  description_en: string | null;
  info_fetched_at: number | null;
}

// Negative cache TTL, for both providers: misses older than this get
// re-asked — boxarts and ScreenScraper entries do get added over time.
export const MISS_TTL_S = 30 * 24 * 60 * 60;

// fetched_at sentinel meaning "row created by an info fetch, boxart never
// probed" — reads as an expired miss, so the boxart gets probed normally.
const NEVER_PROBED = 0;

function rowToDetails(row: DbRow, now: number): GameDetailsRow {
  const boxartMissExpired =
    row.boxart_url === null &&
    (row.fetched_at === NEVER_PROBED || now - row.fetched_at > MISS_TTL_S);
  const infoIsMiss =
    row.year === null &&
    row.genre === null &&
    row.publisher === null &&
    row.description_fr === null &&
    row.description_en === null;
  const infoMissExpired =
    row.info_fetched_at === null || (infoIsMiss && now - row.info_fetched_at > MISS_TTL_S);
  return {
    gameId: row.game_id,
    provider: row.provider,
    boxartUrl: row.boxart_url,
    boxartKnown: !boxartMissExpired,
    year: row.year,
    genre: row.genre,
    publisher: row.publisher,
    descriptionFr: row.description_fr,
    descriptionEn: row.description_en,
    infoKnown: !infoMissExpired,
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

/** Boxart probe results. Never touches the info columns. */
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

export interface GameInfoEntry {
  gameId: string;
  year: number | null;
  genre: string | null;
  publisher: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
}

/** ScreenScraper results. Never touches the boxart columns. */
export function upsertInfo(datId: string, entries: GameInfoEntry[], db: Database = getDb()): void {
  const stmt = db.prepare(
    `INSERT INTO game_details
       (dat_id, game_id, provider, fetched_at, year, genre, publisher,
        description_fr, description_en, info_fetched_at)
     VALUES (?, ?, 'screenscraper', ${NEVER_PROBED}, ?, ?, ?, ?, ?, unixepoch())
     ON CONFLICT(dat_id, game_id) DO UPDATE SET
       year = excluded.year,
       genre = excluded.genre,
       publisher = excluded.publisher,
       description_fr = excluded.description_fr,
       description_en = excluded.description_en,
       info_fetched_at = excluded.info_fetched_at`,
  );
  const insertAll = db.transaction(() => {
    for (const e of entries) {
      stmt.run(datId, e.gameId, e.year, e.genre, e.publisher, e.descriptionFr, e.descriptionEn);
    }
  });
  insertAll();
}
