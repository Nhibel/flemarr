import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { Hono } from 'hono';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatFile } from '@shared/dat.js';
import type { ScanResult } from '@shared/scan.js';
import { createDb } from '../lib/db.js';
import { deleteLastScan, getLastScan, saveLastScan } from '../services/scanner/last-scan.js';
import { runScan, scanJobs } from '../services/scanner/index.js';
import { addDat } from '../services/dat/index.js';
import { scanRoute } from '../routes/scan.js';
import { datsRoute } from '../routes/dats.js';

const RESULT: ScanResult = { matched: [], wrongName: [], unmatched: ['/roms/x.bin'] };

describe('last scan store', () => {
  let db: Database;
  beforeEach(() => {
    db = createDb(':memory:');
  });

  it('has nothing for a DAT never scanned', () => {
    expect(getLastScan('dat1', db)).toBeNull();
  });

  it('keeps the folder, time and result of a scan', () => {
    saveLastScan('dat1', '/roms/snes', RESULT, 1_700_000_000_000, db);
    expect(getLastScan('dat1', db)).toEqual({
      directory: '/roms/snes',
      scannedAt: 1_700_000_000_000,
      result: RESULT,
    });
  });

  it('replaces an earlier scan of the same DAT', () => {
    saveLastScan('dat1', '/old', RESULT, 1, db);
    saveLastScan('dat1', '/new', { ...RESULT, unmatched: [] }, 2, db);
    expect(getLastScan('dat1', db)).toMatchObject({ directory: '/new', scannedAt: 2 });
  });

  it('forgets a deleted DAT', () => {
    saveLastScan('dat1', '/roms', RESULT, 1, db);
    deleteLastScan('dat1', db);
    expect(getLastScan('dat1', db)).toBeNull();
  });
});

const ROOT = join(tmpdir(), 'flemarr-last-scan-test');

const FIXTURE_DAT: DatFile = {
  source: 'no-intro',
  system: 'Last Scan Test',
  games: [
    {
      id: 'g1',
      name: 'Test Game (USA)',
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [{ name: 'Test Game (USA).rom', size: 3, crc: '00000000', status: 'good' }],
    },
  ],
};

describe('a finished scan, through the routes', () => {
  const app = new Hono().route('/api', scanRoute).route('/api', datsRoute);

  beforeEach(async () => {
    await mkdir(ROOT, { recursive: true });
    await writeFile(join(ROOT, 'stray.bin'), 'abc');
  });
  afterEach(async () => {
    await rm(ROOT, { recursive: true, force: true });
  });

  async function finishedScan(datId: string): Promise<void> {
    const jobId = await runScan(datId, ROOT);
    await expect.poll(() => scanJobs.get(jobId)?.status).toBe('done');
  }

  it('is served as the DAT last scan, until the DAT is deleted', async () => {
    const { id } = addDat(FIXTURE_DAT);
    await finishedScan(id);

    const res = await app.request(`/api/dats/${id}/last-scan`);
    const { lastScan } = (await res.json()) as {
      lastScan: { directory: string; result: ScanResult };
    };
    expect(lastScan.directory).toBe(ROOT);
    expect(lastScan.result.unmatched).toEqual([join(ROOT, 'stray.bin')]);

    await app.request(`/api/dats/${id}`, { method: 'DELETE' });
    const after = await app.request(`/api/dats/${id}/last-scan`);
    expect(await after.json()).toEqual({ lastScan: null });
  });
});
