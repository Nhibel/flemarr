import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { DatFile, DatSummary } from '@shared/dat.js';
import type { Fresh1g1rPreset } from '@shared/fresh1g1r.js';
import { getDb } from '@/lib/db.js';

interface DatRow {
  id: string;
  system: string;
  source: string;
  version: string | null;
  date: string | null;
  games_json: string;
}

// Parsed DATs, per database. A big DAT is several MB of JSON (Redump PS1:
// ~6 MB, ~40 ms to read and parse, blocking the event loop) and every
// games, details, resolve and scan request needs it. Dropped on any write to
// that DAT; capped so a session browsing many systems doesn't hold them all.
// Callers must treat the returned DatFile as read-only.
const PARSED_CACHE_SIZE = 4;
const parsedDats = new WeakMap<Database, Map<string, DatFile>>();

function parsedCache(db: Database): Map<string, DatFile> {
  let cache = parsedDats.get(db);
  if (cache === undefined) {
    cache = new Map();
    parsedDats.set(db, cache);
  }
  return cache;
}

function rememberParsed(db: Database, id: string, dat: DatFile): void {
  const cache = parsedCache(db);
  cache.delete(id);
  cache.set(id, dat);
  // Map keeps insertion order: the first key is the least recently used.
  if (cache.size > PARSED_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function addDat(dat: DatFile, db: Database = getDb()): DatSummary {
  // Re-loading a DAT for the same system replaces the previous one instead of
  // piling up duplicates, keeping the same id stable across the update.
  const existing = db
    .prepare(`SELECT id FROM dats WHERE system = ? AND source = ? ORDER BY created_at DESC LIMIT 1`)
    .get(dat.system, dat.source) as { id: string } | undefined;

  if (existing) {
    parsedCache(db).delete(existing.id);
    db.prepare(
      `UPDATE dats SET version = ?, date = ?, games_json = ?, created_at = unixepoch() WHERE id = ?`,
    ).run(dat.version ?? null, dat.date ?? null, JSON.stringify(dat.games), existing.id);
    return {
      id: existing.id,
      system: dat.system,
      gameCount: dat.games.length,
      source: dat.source,
    };
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO dats (id, system, source, version, date, games_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    dat.system,
    dat.source,
    dat.version ?? null,
    dat.date ?? null,
    JSON.stringify(dat.games),
  );
  return { id, system: dat.system, gameCount: dat.games.length, source: dat.source };
}

export function deleteDat(id: string, db: Database = getDb()): boolean {
  parsedCache(db).delete(id);
  return db.prepare(`DELETE FROM dats WHERE id = ?`).run(id).changes > 0;
}

export function getDat(id: string, db: Database = getDb()): DatFile | undefined {
  const cached = parsedCache(db).get(id);
  if (cached !== undefined) {
    rememberParsed(db, id, cached);
    return cached;
  }
  const row = db.prepare(`SELECT * FROM dats WHERE id = ?`).get(id) as DatRow | undefined;
  if (!row) return undefined;
  const dat: DatFile = {
    system: row.system,
    source: row.source as DatFile['source'],
    version: row.version ?? undefined,
    date: row.date ?? undefined,
    games: JSON.parse(row.games_json) as DatFile['games'],
  };
  rememberParsed(db, id, dat);
  return dat;
}

/** Records that a DAT was loaded from Fresh1G1R, so its updates can be found. */
export function setDatOrigin(
  id: string,
  preset: Fresh1g1rPreset,
  path: string,
  db: Database = getDb(),
): void {
  db.prepare(`UPDATE dats SET fresh1g1r_preset = ?, fresh1g1r_path = ? WHERE id = ?`).run(
    preset,
    path,
    id,
  );
}

export interface Fresh1g1rDat {
  id: string;
  version: string | null;
  preset: Fresh1g1rPreset;
  path: string;
}

/** The DATs loaded from Fresh1G1R, with what is needed to look for a newer one. */
export function listFresh1g1rDats(db: Database = getDb()): Fresh1g1rDat[] {
  const rows = db
    .prepare(
      `SELECT id, version, fresh1g1r_preset AS preset, fresh1g1r_path AS path
       FROM dats WHERE fresh1g1r_preset IS NOT NULL AND fresh1g1r_path IS NOT NULL`,
    )
    .all() as Fresh1g1rDat[];
  return rows;
}

export function listDats(db: Database = getDb()): Array<DatSummary & { id: string }> {
  const rows = db
    .prepare(
      `SELECT id, system, source, json_array_length(games_json) AS game_count FROM dats ORDER BY created_at DESC`,
    )
    .all() as { id: string; system: string; source: string; game_count: number }[];
  return rows.map((r) => ({
    id: r.id,
    system: r.system,
    source: r.source as DatFile['source'],
    gameCount: r.game_count,
  }));
}
