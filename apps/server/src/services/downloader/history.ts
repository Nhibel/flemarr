import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { DownloadHistoryEntry as PastDownload } from '@shared/download.js';
import { getDb } from '@/lib/db.js';

export interface DownloadHistoryEntry {
  gameId: string;
  romName: string;
  datId: string;
  destination: string;
  expectedCrc: string;
  status: 'done' | 'failed';
  errorMessage?: string;
}

export function recordDownload(entry: DownloadHistoryEntry, db: Database = getDb()): void {
  db.prepare(
    `INSERT INTO download_history (id, game_id, rom_name, dat_id, destination, expected_crc, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    entry.gameId,
    entry.romName,
    entry.datId,
    entry.destination,
    entry.expectedCrc,
    entry.status,
    entry.errorMessage ?? null,
  );
}

interface HistoryRow {
  game_id: string;
  rom_name: string;
  destination: string;
  status: 'done' | 'failed';
  error_message: string | null;
  completed_at: number;
}

// Enough for a month of normal use; a runaway loop can't flood the page.
const HISTORY_LIMIT = 500;

/** The DAT's download attempts since `sinceMs`, newest first. */
export function listDownloadHistory(
  datId: string,
  sinceMs: number,
  db: Database = getDb(),
): PastDownload[] {
  const rows = db
    .prepare(
      `SELECT game_id, rom_name, destination, status, error_message, completed_at
       FROM download_history WHERE dat_id = ? AND completed_at >= ?
       ORDER BY completed_at DESC LIMIT ?`,
    )
    .all(datId, Math.floor(sinceMs / 1000), HISTORY_LIMIT) as HistoryRow[];
  return rows.map((row) => ({
    gameId: row.game_id,
    romName: row.rom_name,
    destination: row.destination,
    status: row.status,
    errorMessage: row.error_message,
    completedAt: row.completed_at * 1000,
  }));
}

export function deleteDownloadHistory(datId: string, db: Database = getDb()): void {
  db.prepare(`DELETE FROM download_history WHERE dat_id = ?`).run(datId);
}
