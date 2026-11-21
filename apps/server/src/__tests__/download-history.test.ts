import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createDb } from '../lib/db.js';
import {
  deleteDownloadHistory,
  listDownloadHistory,
  recordDownload,
} from '../services/downloader/history.js';

let db: Database;

function record(gameId: string, status: 'done' | 'failed', datId = 'dat1') {
  recordDownload(
    {
      gameId,
      romName: `${gameId}.bin`,
      datId,
      destination: '/roms',
      expectedCrc: 'aabbccdd',
      status,
      errorMessage: status === 'failed' ? 'CRC mismatch' : undefined,
    },
    db,
  );
}

beforeEach(() => {
  db = createDb(':memory:');
});

describe('listDownloadHistory', () => {
  it("lists the DAT's attempts with their outcome", () => {
    record('g1', 'failed');
    record('g2', 'done', 'other-dat');
    const entries = listDownloadHistory('dat1', 0, db);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      gameId: 'g1',
      romName: 'g1.bin',
      status: 'failed',
      errorMessage: 'CRC mismatch',
    });
  });

  it('leaves out attempts older than the window', () => {
    record('g1', 'done');
    expect(listDownloadHistory('dat1', Date.now() + 60_000, db)).toEqual([]);
  });

  it('gives times in milliseconds', () => {
    record('g1', 'done');
    const [entry] = listDownloadHistory('dat1', 0, db);
    expect(Math.abs(entry!.completedAt - Date.now())).toBeLessThan(5_000);
  });

  it('forgets a deleted DAT', () => {
    record('g1', 'done');
    deleteDownloadHistory('dat1', db);
    expect(listDownloadHistory('dat1', 0, db)).toEqual([]);
  });
});
