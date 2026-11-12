import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  startDownload,
  cancelJob,
  cancelItem,
  downloadJobs,
} from '../services/downloader/index.js';
import { updateSettings } from '../services/settings/index.js';
import type { DownloadRequest } from '@shared/download.js';

vi.mock('../services/downloader/worker.js', () => ({
  downloadFile: vi.fn(),
  extractContainerEntry: vi.fn(),
}));

import { downloadFile, extractContainerEntry } from '../services/downloader/worker.js';

const TMP = join(tmpdir(), 'rom-curator-queue-test');

const ITEM = {
  gameId: 'smw',
  romName: 'Super Mario World (USA).sfc',
  expectedCrc: 'b19ed489',
  sources: [{ url: 'https://archive.org/download/test/game.sfc', extractFromZip: false }],
};

beforeEach(async () => {
  await mkdir(TMP, { recursive: true });
  updateSettings({ systemPaths: { test: TMP } });
  vi.mocked(downloadFile).mockReset();
  vi.mocked(extractContainerEntry).mockReset();
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
        items: [
          {
            ...ITEM,
            sources: [
              { url: 'https://a.example/rom', extractFromZip: false },
              { url: 'https://b.example/rom', extractFromZip: false },
            ],
          },
        ],
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
        items: [
          {
            ...ITEM,
            sources: [
              { url: 'https://a.example/rom', extractFromZip: false },
              { url: 'https://b.example/rom', extractFromZip: false },
            ],
          },
        ],
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
        items: [
          {
            ...ITEM,
            sources: [
              { url: 'https://a.example/rom', extractFromZip: false },
              { url: 'https://b.example/rom', extractFromZip: false },
            ],
          },
        ],
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

describe('cancelItem', () => {
  it('returns false for unknown jobId', async () => {
    expect(await cancelItem('nonexistent', 'g1', 'Game1.sfc')).toBe(false);
  });

  it('returns false for an item not in the job', async () => {
    vi.mocked(downloadFile).mockResolvedValue('done');
    const jobId = await startDownload(makeRequest());
    expect(await cancelItem(jobId, 'does-not-exist', 'nope.sfc')).toBe(false);
  });

  it('cancels one item without affecting its siblings', async () => {
    // Item 1 blocks until its own signal aborts; item 2 resolves normally —
    // if cancelItem touched the job's shared controller instead of this
    // item's own, item 2 would never get a chance to finish.
    vi.mocked(downloadFile).mockImplementation(({ signal, url }) => {
      if (url.includes('g1')) {
        return new Promise((resolve) => {
          signal.addEventListener('abort', () => resolve('cancelled'));
        });
      }
      return Promise.resolve('done');
    });

    const jobId = await startDownload({
      datId: 'dat-001',
      items: [
        {
          ...ITEM,
          gameId: 'g1',
          romName: 'Game1.sfc',
          sources: [{ url: 'https://x/g1', extractFromZip: false }],
        },
        {
          ...ITEM,
          gameId: 'g2',
          romName: 'Game2.sfc',
          sources: [{ url: 'https://x/g2', extractFromZip: false }],
        },
      ],
      target: 'server',
      destinationDir: TMP,
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(await cancelItem(jobId, 'g1', 'Game1.sfc')).toBe(true);
    await new Promise((r) => setTimeout(r, 100));

    const job = downloadJobs.get(jobId)!;
    // The job itself finishes normally — cancelling one item doesn't cancel
    // the job, unlike cancelJob.
    expect(job.status).toBe('done');
    expect(job.events.at(-1)?.type).toBe('complete');
    const cancelledEvent = job.events.find((e) => e.type === 'file-cancelled' && e.gameId === 'g1');
    expect(cancelledEvent).toBeDefined();
    const doneEvent = job.events.find((e) => e.type === 'file-done' && e.gameId === 'g2');
    expect(doneEvent).toBeDefined();
  });

  it('returns false once the item has already finished', async () => {
    vi.mocked(downloadFile).mockResolvedValue('done');
    const jobId = await startDownload(makeRequest());
    await new Promise((r) => setTimeout(r, 100));

    expect(await cancelItem(jobId, ITEM.gameId, ITEM.romName)).toBe(false);
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

describe('archive-container fast path — shared container dedup', () => {
  const SHARED_URL = 'https://archive.org/download/test/Game%20(USA).7z';

  it('fetches a container shared by two roms only once, and extracts each separately', async () => {
    let containerFetches = 0;
    vi.mocked(downloadFile).mockImplementation(async ({ tempPath }) => {
      containerFetches += 1;
      await mkdir(dirname(tempPath), { recursive: true });
      await writeFile(tempPath, 'fake container bytes');
      return 'done';
    });
    vi.mocked(extractContainerEntry).mockResolvedValue('done');

    const jobId = await startDownload({
      datId: 'dat-001',
      items: [
        {
          gameId: 'g1',
          romName: 'Game (USA).bin',
          expectedCrc: 'aaaaaaaa',
          sources: [{ url: SHARED_URL, extractFromZip: false, innerPath: 'Game (USA).bin' }],
        },
        {
          gameId: 'g1',
          romName: 'Game (USA).cue',
          expectedCrc: 'bbbbbbbb',
          sources: [{ url: SHARED_URL, extractFromZip: false, innerPath: 'Game (USA).cue' }],
        },
      ],
      target: 'server',
      destinationDir: TMP,
    });
    await new Promise((r) => setTimeout(r, 150));

    expect(containerFetches).toBe(1);
    expect(vi.mocked(extractContainerEntry)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(extractContainerEntry).mock.calls[0]?.[0]?.innerPath).toBe('Game (USA).bin');
    expect(vi.mocked(extractContainerEntry).mock.calls[1]?.[0]?.innerPath).toBe('Game (USA).cue');

    const job = downloadJobs.get(jobId)!;
    expect(job.events.at(-1)?.type).toBe('complete');

    // The shared container temp file is cleaned up once the job finishes —
    // not left behind now that every rom referencing it is done.
    const containerArgs = vi.mocked(downloadFile).mock.calls[0]![0]!;
    await expect(access(containerArgs.tempPath)).rejects.toThrow();
  });

  it('cleans up the shared container on cancelJob too', async () => {
    let resolveContainer: (() => Promise<void>) | undefined;
    vi.mocked(downloadFile).mockImplementation(
      ({ tempPath }) =>
        new Promise((resolve) => {
          resolveContainer = async () => {
            await mkdir(dirname(tempPath), { recursive: true });
            await writeFile(tempPath, 'fake container bytes');
            resolve('done');
          };
        }),
    );
    vi.mocked(extractContainerEntry).mockResolvedValue('done');

    const jobId = await startDownload({
      datId: 'dat-001',
      items: [
        {
          gameId: 'g1',
          romName: 'Game (USA).bin',
          expectedCrc: 'aaaaaaaa',
          sources: [{ url: SHARED_URL, extractFromZip: false, innerPath: 'Game (USA).bin' }],
        },
      ],
      target: 'server',
      destinationDir: TMP,
    });

    await new Promise((r) => setTimeout(r, 20));
    await resolveContainer?.();
    const containerPath = vi.mocked(downloadFile).mock.calls[0]![0].tempPath;
    await expect(access(containerPath)).resolves.toBeUndefined();

    expect(await cancelJob(jobId)).toBe(true);
    await expect(access(containerPath)).rejects.toThrow();
  });
});
