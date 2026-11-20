import type { Database } from 'better-sqlite3';
import type { ArchiveSource, ConfiguredSource } from '@shared/archive.js';
import { getDb } from '@/lib/db.js';

interface SourceRow {
  identifier: string;
  system: string;
  layout: string;
  note: string;
  searched: number;
}

function rowToSource(row: SourceRow): ConfiguredSource {
  return {
    identifier: row.identifier,
    layout: row.layout as ArchiveSource['layout'],
    note: row.note,
    searched: row.searched === 1,
  };
}

export function getSources(system: string, db: Database = getDb()): ConfiguredSource[] {
  const rows = db
    .prepare(`SELECT * FROM archive_sources WHERE system = ? ORDER BY identifier`)
    .all(system) as SourceRow[];
  return rows.map(rowToSource);
}

export function getAllSystems(db: Database = getDb()): string[] {
  const rows = db.prepare(`SELECT DISTINCT system FROM archive_sources ORDER BY system`).all() as {
    system: string;
  }[];
  return rows.map((r) => r.system);
}

// Keyed on (identifier, system): the same collection can serve several
// systems (see migration005). Re-adding a pair updates its layout, so
// correcting a wrongly-detected layout works instead of being ignored; an
// empty incoming note keeps the stored one rather than wiping it.
export function addSource(system: string, source: ArchiveSource, db: Database = getDb()): void {
  db.prepare(
    `INSERT INTO archive_sources (identifier, system, layout, note) VALUES (?, ?, ?, ?)
     ON CONFLICT(identifier, system) DO UPDATE SET
       layout = excluded.layout,
       note = CASE WHEN excluded.note <> '' THEN excluded.note ELSE archive_sources.note END`,
  ).run(source.identifier, system, source.layout, source.note);
}

/** Switches a source on or off for resolves. False when the pair isn't configured. */
export function setSourceSearched(
  identifier: string,
  system: string,
  searched: boolean,
  db: Database = getDb(),
): boolean {
  const result = db
    .prepare(`UPDATE archive_sources SET searched = ? WHERE identifier = ? AND system = ?`)
    .run(searched ? 1 : 0, identifier, system);
  return result.changes > 0;
}

export function removeSource(identifier: string, system: string, db: Database = getDb()): boolean {
  const result = db
    .prepare(`DELETE FROM archive_sources WHERE identifier = ? AND system = ?`)
    .run(identifier, system);
  return result.changes > 0;
}
