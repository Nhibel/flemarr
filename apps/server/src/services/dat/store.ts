import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { DatFile, DatSummary } from '@shared/dat.js';
import { getDb } from '@/lib/db.js';

interface DatRow {
  id: string;
  system: string;
  source: string;
  version: string | null;
  date: string | null;
  games_json: string;
}

export function addDat(dat: DatFile, db: Database = getDb()): DatSummary {
  // Re-loading a DAT for the same system replaces the previous one instead of
  // piling up duplicates. The id is kept so localStorage selections (keyed by
  // dat id) survive a DAT update.
  const existing = db
    .prepare(`SELECT id FROM dats WHERE system = ? AND source = ? ORDER BY created_at DESC LIMIT 1`)
    .get(dat.system, dat.source) as { id: string } | undefined;

  if (existing) {
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
  return db.prepare(`DELETE FROM dats WHERE id = ?`).run(id).changes > 0;
}

export function getDat(id: string, db: Database = getDb()): DatFile | undefined {
  const row = db.prepare(`SELECT * FROM dats WHERE id = ?`).get(id) as DatRow | undefined;
  if (!row) return undefined;
  return {
    system: row.system,
    source: row.source as DatFile['source'],
    version: row.version ?? undefined,
    date: row.date ?? undefined,
    games: JSON.parse(row.games_json) as DatFile['games'],
  };
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
