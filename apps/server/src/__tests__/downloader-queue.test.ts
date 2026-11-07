import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startDownload, cancelJob, downloadJobs } from '../services/downloader/index.js';
import { updateSettings } from '../services/settings/index.js';
import type { DownloadRequest } from '@shared/download.js';

vi.mock('../services/downloader/worker.js', () => ({
  downloadFile: vi.fn(),
}));

import { downloadFile } from '../services/downloader/worker.js';

const TMP = join(tmpdir(), 'rom-curator-queue-test');

const ITEM = {
  gameId: 'smw',
  romName: 'Super Mario World (USA).sfc',
  expectedCrc: 'b19ed489',
  downloadUrls: ['https://archive.org/download/test/game.sfc'],
  extractFromZip: false,
};

beforeEach(async () => {
  await mkdir(TMP, { recursive: true });
  updateSettings({ systemPaths: { test: TMP } });
  vi.mocked(downloadFile).mockReset();
  downloadJobs.clear();
});

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true });
});

function makeRequest(overrides: Partial<DownloadRequest> = {}): DownloadRequest {
  return { datId: 'dat-001', items: [ITEM], target: 'server', destinationDir: TMP, ...overrides };
}

describe('startDownload', () => {
  it('returns a jobId immediately', async () => {
    vi.mocked(downloadFile).mockResolvedValue('done');
    const jobId = await startDownload(makeRequest());
    expect(typeof jobId).toBe('string');
    expect(jobId.length).toBeGreaterThan(0);
  });

  it('registers the job in downloadJobs', async () => {
    vi.mocked(downloadFile).mockResolvedValue('done');
    const jobId = await startDownload(makeRequest());
    expect(downloadJobs.has(jobId)).toBe(true);
  });

  it('emits file-done and complete events on success', async () => {
    // Mock rename so it doesn't fail on missing temp file
    vi.mock('node:fs/promises', async (orig) => {
      const actual = await orig<typeof import('node:fs/promises')>();
      return { ...actual, rename: vi.fn().mockResolvedValue(undefined) };
    });

    vi.mocked(downloadFile).mockResolvedValue('done');
    const jobId = await startDownload(makeRequest());

    // Wait for background queue to finish
    await new Promise((r) => setTimeout(r, 100));

    const job = downloadJobs.get(jobId)!;
    const types = job.events.map((e) => e.type);
    expect(types).toContain('file-done');
    expect(types).toContain('complete');
  });

  it('emits file-failed event on crc-mismatch', async () => {
    vi.mocked(downloadFile).mockResolvedValue('crc-mismatch');
    const jobId = await startDownload(makeRequest());

    await new Promise((r) => setTimeout(r, 100));

    const job = downloadJobs.get(jobId)!;
    const failed = job.events.find((e) => e.type === 'file-failed');
    expect(failed).toBeDefined();
    if (failed?.type === 'file-failed') {
      expect(failed.reason).toBe('CRC mismatch');
    }
  });

  it('falls back to the next URL on HTTP failure', async () => {
    vi.mocked(downloadFile)
      .mockRejectedValueOnce(new Error('HTTP 404 fetching first-url'))
      .mockResolvedValueOnce('done');

    const jobId = await startDownload(
      makeRequest({
        items: [{ ...ITEM, downloadUrls: ['https://a.example/rom', 'https://b.example/rom'] }],
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(downloadFile)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(downloadFile).mock.calls[0]?.[0]?.url).toBe('https://a.example/rom');
    expect(vi.mocked(downloadFile).mock.calls[1]?.[0]?.url).toBe('https://b.example/rom');
    const job = downloadJobs.get(jobId)!;
    expect(job.events.map((e) => e.type)).toContain('file-done');
  });

  it('does not fall back after a CRC mismatch', async () => {
    vi.mocked(downloadFile).mockResolvedValue('crc-mismatch');

    const jobId = await startDownload(
      makeRequest({
        items: [{ ...ITEM, downloadUrls: ['https://a.example/rom', 'https://b.example/rom'] }],
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(downloadFile)).toHaveBeenCalledTimes(1);
    const job = downloadJobs.get(jobId)!;
    const failed = job.events.find((e) => e.type === 'file-failed');
    expect(failed).toBeDefined();
  });

  it('reports failure when every URL fails', async () => {
    vi.mocked(downloadFile).mockRejectedValue(new Error('HTTP 404'));

    const jobId = await startDownload(
      makeRequest({
        items: [{ ...ITEM, downloadUrls: ['https://a.example/rom', 'https://b.example/rom'] }],
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(downloadFile)).toHaveBeenCalledTimes(2);
    const job = downloadJobs.get(jobId)!;
    const failed = job.events.find((e) => e.type === 'file-failed');
    expect(failed?.type === 'file-failed' && failed.reason).toContain('HTTP 404');
  });

  it('records download history for done and failed files', async () => {
    const { getDb } = await import('../lib/db.js');

    vi.mocked(downloadFile).mockResolvedValue('crc-mismatch');
    await startDownload(makeRequest({ datId: 'dat-history-test' }));
    await new Promise((r) => setTimeout(r, 100));

    const rows = getDb()
      .prepare(`SELECT * FROM download_history WHERE dat_id = ?`)
      .all('dat-history-test') as { status: string; error_message: string | null }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('failed');
    expect(rows[0]?.error_message).toBe('CRC mismatch');
  });
});

describe('cancelJob', () => {
  it('returns false for unknown jobId', async () => {
    expect(await cancelJob('nonexistent')).toBe(false);
  });

  it('aborts a running job', async () => {
    // Worker that blocks until aborted
    vi.mocked(downloadFile).mockImplementation(
      ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => resolve('cancelled'));
        }),
    );

    const jobId = await startDownload(makeRequest());
    const cancelled = await cancelJob(jobId);
    expect(cancelled).toBe(true);

    await new Promise((r) => setTimeout(r, 50));
    const job = downloadJobs.get(jobId)!;
    expect(job.status).toBe('cancelled');
  });
});

describe('startDownload — multiple items with concurrency', () => {
  it('processes all items', async () => {
    vi.mocked(downloadFile).mockResolvedValue('done');

    const request: DownloadRequest = {
      datId: 'dat-001',
      items: [
        { ...ITEM, gameId: 'g1', romName: 'Game1.sfc' },
        { ...ITEM, gameId: 'g2', romName: 'Game2.sfc' },
        { ...ITEM, gameId: 'g3', romName: 'Game3.sfc' },
      ],
      target: 'server',
      destinationDir: TMP,
    };

    const jobId = await startDownload(request);
    await new Promise((r) => setTimeout(r, 150));

    expect(vi.mocked(downloadFile)).toHaveBeenCalledTimes(3);
    const job = downloadJobs.get(jobId)!;
    expect(job.events.at(-1)?.type).toBe('complete');
  });
});
