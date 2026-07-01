import type { Database } from 'better-sqlite3';
import type { ArchiveSource } from '@shared/archive.js';
import { getDb } from '@/lib/db.js';

interface SourceRow {
  identifier: string;
  system: string;
  layout: string;
  note: string;
}

function rowToSource(row: SourceRow): ArchiveSource {
  return {
    identifier: row.identifier,
    layout: row.layout as ArchiveSource['layout'],
    note: row.note,
  };
}

export function getSources(system: string, db: Database = getDb()): ArchiveSource[] {
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

export function addSource(system: string, source: ArchiveSource, db: Database = getDb()): void {
  db.prepare(
    `INSERT OR IGNORE INTO archive_sources (identifier, system, layout, note) VALUES (?, ?, ?, ?)`,
  ).run(source.identifier, system, source.layout, source.note);
}

export function removeSource(identifier: string, db: Database = getDb()): boolean {
  const result = db.prepare(`DELETE FROM archive_sources WHERE identifier = ?`).run(identifier);
  return result.changes > 0;
}

export function findSystemForIdentifier(
  identifier: string,
  db: Database = getDb(),
): string | undefined {
  const row = db
    .prepare(`SELECT system FROM archive_sources WHERE identifier = ?`)
    .get(identifier) as { system: string } | undefined;
  return row?.system;
}
