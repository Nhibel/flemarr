import type { Database } from 'better-sqlite3';
import type { LastScan, ScanResult } from '@shared/scan.js';
import { getDb } from '@/lib/db.js';

interface LastScanRow {
  directory: string;
  result_json: string;
  scanned_at: number;
}

/** Keeps a finished scan as the DAT's last one, replacing any earlier. */
export function saveLastScan(
  datId: string,
  directory: string,
  result: ScanResult,
  scannedAt: number,
  db: Database = getDb(),
): void {
  db.prepare(
    `INSERT INTO last_scans (dat_id, directory, result_json, scanned_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(dat_id) DO UPDATE SET
       directory = excluded.directory,
       result_json = excluded.result_json,
       scanned_at = excluded.scanned_at`,
  ).run(datId, directory, JSON.stringify(result), scannedAt);
}

/** The DAT's last scan, or null when it was never scanned. */
export function getLastScan(datId: string, db: Database = getDb()): LastScan | null {
  const row = db
    .prepare(`SELECT directory, result_json, scanned_at FROM last_scans WHERE dat_id = ?`)
    .get(datId) as LastScanRow | undefined;
  if (row === undefined) return null;
  return {
    directory: row.directory,
    scannedAt: row.scanned_at,
    result: JSON.parse(row.result_json) as ScanResult,
  };
}

export function deleteLastScan(datId: string, db: Database = getDb()): void {
  db.prepare(`DELETE FROM last_scans WHERE dat_id = ?`).run(datId);
}
