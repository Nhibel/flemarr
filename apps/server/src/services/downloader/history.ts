import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
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
