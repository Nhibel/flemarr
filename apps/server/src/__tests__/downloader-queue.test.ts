import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  startDownload,
  cancelJob,
  cancelItem,
  downloadJobs,
  findBrowserFile,
} from '../services/downloader/index.js';
import { updateSettings } from '../services/settings/index.js';
import type { DownloadRequest } from '@shared/download.js';

vi.mock('../services/downloader/worker.js', () => ({
  downloadFile: vi.fn(),
  extractContainerEntry: vi.fn(),
}));
vi.mock('../services/downloader/chd.js', () => ({
  convertGameToChd: vi.fn(),
}));
vi.mock('../services/dat/store.js', () => ({
  getDat: vi.fn(),
}));

import { downloadFile, extractContainerEntry } from '../services/downloader/worker.js';
import { convertGameToChd } from '../services/downloader/chd.js';
import { getDat } from '../services/dat/store.js';
import type { DatFile } from '@shared/dat.js';

const TMP = join(tmpdir(), 'flemarr-queue-test');

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
  vi.mocked(convertGameToChd).mockReset();
  vi.mocked(getDat).mockReset();
  downloadJobs.clear();
});

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true });
});

function makeRequest(overrides: Partial<DownloadRequest> = {}): DownloadRequest {
  return { datId: 'dat-001', items: [ITEM], target: 'server', destinationDir: TMP, ...overrides };
}

// The job's work hits the real disk: no fixed delay is always long enough.
async function jobEnd(jobId: string): Promise<void> {
  await vi.waitFor(
    () => {
      expect(['complete', 'cancelled']).toContain(downloadJobs.get(jobId)?.events.at(-1)?.type);
    },
    { timeout: 10_000, interval: 10 },
  );
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
    await jobEnd(jobId);

    expect(vi.mocked(downloadFile)).toHaveBeenCalledTimes(3);
    const job = downloadJobs.get(jobId)!;
    expect(job.events.at(-1)?.type).toBe('complete');
  });

  it('a multi-file game does not exhaust the concurrency pool for other queued games', async () => {
    updateSettings({ downloaderConcurrency: 2 });

    let releaseG1: (() => void) | undefined;
    const g1Gate = new Promise<void>((resolve) => {
      releaseG1 = resolve;
    });
    vi.mocked(downloadFile).mockImplementation(async ({ url }) => {
      if (url.includes('/g1-')) await g1Gate;
      return 'done';
    });

    await startDownload({
      datId: 'dat-001',
      items: [
        {
          gameId: 'g1',
          romName: 'G1 (Track 1).bin',
          expectedCrc: 'aaaaaaaa',
          sources: [{ url: 'https://x/g1-1', extractFromZip: false }],
        },
        {
          gameId: 'g1',
          romName: 'G1 (Track 2).bin',
          expectedCrc: 'bbbbbbbb',
          sources: [{ url: 'https://x/g1-2', extractFromZip: false }],
        },
        {
          gameId: 'g2',
          romName: 'G2.sfc',
          expectedCrc: 'cccccccc',
          sources: [{ url: 'https://x/g2', extractFromZip: false }],
        },
      ],
      target: 'server',
      destinationDir: TMP,
    });
    await new Promise((r) => setTimeout(r, 50));

    // With concurrency=2 meaning two GAMES, both of g1's own roms (still
    // gated on g1Gate) and g2's single rom should all have started — g1's
    // two files must not, by themselves, consume both available slots and
    // leave g2 waiting on them to finish first.
    expect(vi.mocked(downloadFile)).toHaveBeenCalledTimes(3);

    releaseG1!();
    await new Promise((r) => setTimeout(r, 50));
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
    await jobEnd(jobId);

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

  it("fans the shared container's progress out to every rom waiting on it", async () => {
    // A per-game archive is itself hundreds of MB — without fanning the one
    // real download's progress out to every item sharing it, nothing at all
    // showed in the UI until the whole container finished, which looked
    // exactly like the download never started.
    vi.mocked(downloadFile).mockImplementation(async ({ tempPath, onProgress }) => {
      await mkdir(dirname(tempPath), { recursive: true });
      await writeFile(tempPath, 'fake container bytes');
      onProgress?.(50, 100);
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
    await jobEnd(jobId);

    const job = downloadJobs.get(jobId)!;
    const binProgress = job.events.find(
      (e) => e.type === 'progress' && e.romName === 'Game (USA).bin',
    );
    const cueProgress = job.events.find(
      (e) => e.type === 'progress' && e.romName === 'Game (USA).cue',
    );
    expect(binProgress).toBeDefined();
    expect(cueProgress).toBeDefined();
  });

  it('emits file-extracting once the container is fully downloaded, before extraction runs', async () => {
    vi.mocked(downloadFile).mockImplementation(async ({ tempPath }) => {
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
      ],
      target: 'server',
      destinationDir: TMP,
    });
    await jobEnd(jobId);

    const job = downloadJobs.get(jobId)!;
    const types = job.events.map((e) => e.type);
    expect(types.indexOf('file-extracting')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('file-extracting')).toBeLessThan(types.indexOf('file-done'));
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

  it('cancelling one item takes effect immediately, even while its container is still downloading', async () => {
    // The real bug report: cancelling a row "en cours" had no visible
    // effect. getOrFetchContainer deliberately uses the job's signal, not
    // this item's own (a sibling might still need the container), so
    // without racing against the item's own signal separately, aborting
    // just this item's controller did nothing until the (possibly huge,
    // possibly shared) container finished downloading on its own.
    vi.mocked(downloadFile).mockImplementation(() => new Promise(() => undefined)); // never resolves
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
    expect(await cancelItem(jobId, 'g1', 'Game (USA).bin')).toBe(true);
    await new Promise((r) => setTimeout(r, 20));

    const job = downloadJobs.get(jobId)!;
    const cancelledEvent = job.events.find((e) => e.type === 'file-cancelled');
    expect(cancelledEvent).toBeDefined();
    // The job itself isn't cancelled — only this one item was.
    expect(job.status).toBe('running');
  });

  it('aborts the shared container once every item using it has been cancelled, and the job reaches complete', async () => {
    // The real bug report: cancelling both rows of a 2-item job left the
    // real container download running to completion in the background
    // regardless (nothing released its claim on the fetch), which also
    // blocked the job from ever finishing — the job-level "Annuler" button
    // stayed up long after both rows had already disappeared.
    let containerSignal: AbortSignal | undefined;
    vi.mocked(downloadFile).mockImplementation(
      ({ signal }) =>
        new Promise((resolve) => {
          containerSignal = signal;
          signal.addEventListener('abort', () => resolve('cancelled'));
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

    await new Promise((r) => setTimeout(r, 20));
    expect(await cancelItem(jobId, 'g1', 'Game (USA).bin')).toBe(true);
    expect(await cancelItem(jobId, 'g1', 'Game (USA).cue')).toBe(true);
    await new Promise((r) => setTimeout(r, 20));

    expect(containerSignal?.aborted).toBe(true);
    const job = downloadJobs.get(jobId)!;
    expect(job.events.at(-1)?.type).toBe('complete');
    expect(job.status).toBe('done');
  });
});

describe('autoConvertChd', () => {
  const DISC_DAT: DatFile = {
    source: 'redump',
    system: 'Sony - PlayStation',
    games: [
      {
        id: 'g1',
        name: 'Game (USA)',
        region: ['USA'],
        languages: ['En'],
        roms: [
          { name: 'Game (USA).bin', size: 1, crc: 'aaaaaaaa', status: 'good' },
          { name: 'Game (USA).cue', size: 1, crc: 'bbbbbbbb', status: 'good' },
        ],
      },
    ],
  };
  const CARTRIDGE_DAT: DatFile = {
    source: 'no-intro',
    system: 'Nintendo - Super Nintendo Entertainment System',
    games: [
      {
        id: 'g1',
        name: 'Game (USA)',
        region: ['USA'],
        languages: ['En'],
        roms: [{ name: 'Game (USA).sfc', size: 1, crc: 'aaaaaaaa', status: 'good' }],
      },
    ],
  };

  const discItems = [
    {
      gameId: 'g1',
      romName: 'Game (USA).bin',
      expectedCrc: 'aaaaaaaa',
      sources: [{ url: 'https://x/bin', extractFromZip: false }],
    },
    {
      gameId: 'g1',
      romName: 'Game (USA).cue',
      expectedCrc: 'bbbbbbbb',
      sources: [{ url: 'https://x/cue', extractFromZip: false }],
    },
  ];

  it('converts only once every rom of the game has finished, never before', async () => {
    updateSettings({ autoConvertChd: true });
    vi.mocked(getDat).mockReturnValue(DISC_DAT);
    vi.mocked(downloadFile).mockResolvedValue('done');
    vi.mocked(convertGameToChd).mockResolvedValue({ ok: true });

    const jobId = await startDownload({
      datId: 'dat-001',
      items: discItems,
      target: 'server',
      destinationDir: TMP,
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(convertGameToChd)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertGameToChd).mock.calls[0]?.[0]).toBe(TMP);
    expect(vi.mocked(convertGameToChd).mock.calls[0]?.[1]?.map((r) => r.name)).toEqual([
      'Game (USA).bin',
      'Game (USA).cue',
    ]);

    const job = downloadJobs.get(jobId)!;
    const types = job.events.map((e) => e.type);
    // Both files done before conversion starts, not interleaved.
    expect(types.indexOf('game-converting')).toBeGreaterThan(types.lastIndexOf('file-done'));
    expect(types).toContain('game-converted');
  });

  it('does not convert when autoConvertChd is off', async () => {
    updateSettings({ autoConvertChd: false });
    vi.mocked(getDat).mockReturnValue(DISC_DAT);
    vi.mocked(downloadFile).mockResolvedValue('done');

    await startDownload({
      datId: 'dat-001',
      items: discItems,
      target: 'server',
      destinationDir: TMP,
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(convertGameToChd)).not.toHaveBeenCalled();
  });

  it('does not convert a cartridge game (no .cue in the DAT)', async () => {
    updateSettings({ autoConvertChd: true });
    vi.mocked(getDat).mockReturnValue(CARTRIDGE_DAT);
    vi.mocked(downloadFile).mockResolvedValue('done');

    await startDownload({
      datId: 'dat-001',
      items: [
        {
          gameId: 'g1',
          romName: 'Game (USA).sfc',
          expectedCrc: 'aaaaaaaa',
          sources: [{ url: 'https://x/sfc', extractFromZip: false }],
        },
      ],
      target: 'server',
      destinationDir: TMP,
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(convertGameToChd)).not.toHaveBeenCalled();
  });

  it('emits game-convert-failed and still completes the job when conversion fails', async () => {
    updateSettings({ autoConvertChd: true });
    vi.mocked(getDat).mockReturnValue(DISC_DAT);
    vi.mocked(downloadFile).mockResolvedValue('done');
    vi.mocked(convertGameToChd).mockResolvedValue({ ok: false, reason: 'createcd failed: boom' });

    const jobId = await startDownload({
      datId: 'dat-001',
      items: discItems,
      target: 'server',
      destinationDir: TMP,
    });
    await new Promise((r) => setTimeout(r, 100));

    const job = downloadJobs.get(jobId)!;
    const failedEvent = job.events.find((e) => e.type === 'game-convert-failed');
    expect(failedEvent).toBeDefined();
    if (failedEvent?.type === 'game-convert-failed') {
      expect(failedEvent.reason).toContain('boom');
    }
    expect(job.events.at(-1)?.type).toBe('complete');
    expect(job.status).toBe('done');
  });

  it('does not gate a cartridge game behind conversion in browser target either', async () => {
    updateSettings({ autoConvertChd: true });
    vi.mocked(getDat).mockReturnValue(CARTRIDGE_DAT);
    vi.mocked(downloadFile).mockResolvedValue('done');

    const jobId = await startDownload({
      datId: 'dat-001',
      items: [
        {
          gameId: 'g1',
          romName: 'Game (USA).sfc',
          expectedCrc: 'aaaaaaaa',
          sources: [{ url: 'https://x/sfc', extractFromZip: false }],
        },
      ],
      target: 'browser',
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(vi.mocked(convertGameToChd)).not.toHaveBeenCalled();
    const job = downloadJobs.get(jobId)!;
    expect(job.events.some((e) => e.type === 'file-ready')).toBe(true);
    expect(job.events.some((e) => e.type === 'file-done')).toBe(false);
  });

  it('converts browser-target disc downloads into a single .chd save instead of two individual ones', async () => {
    updateSettings({ autoConvertChd: true });
    vi.mocked(getDat).mockReturnValue(DISC_DAT);
    vi.mocked(downloadFile).mockImplementation(async ({ tempPath }) => {
      await mkdir(dirname(tempPath), { recursive: true });
      await writeFile(tempPath, 'raw-bytes');
      return 'done';
    });
    vi.mocked(convertGameToChd).mockImplementation(async (destinationDir) => {
      const chdPath = join(destinationDir, 'Game (USA).chd');
      await writeFile(chdPath, 'fake-chd-bytes');
      return { ok: true, chdPath };
    });

    const jobId = await startDownload({
      datId: 'dat-001',
      items: discItems,
      target: 'browser',
    });
    await jobEnd(jobId);

    const job = downloadJobs.get(jobId)!;

    const fileDoneRoms = job.events
      .filter((e) => e.type === 'file-done')
      .map((e) => (e.type === 'file-done' ? e.romName : undefined))
      .sort();
    expect(fileDoneRoms).toEqual(['Game (USA).bin', 'Game (USA).cue']);

    const fileReadyEvents = job.events.filter((e) => e.type === 'file-ready');
    expect(fileReadyEvents).toHaveLength(1);
    expect(fileReadyEvents[0]).toMatchObject({ gameId: 'g1', romName: 'Game (USA).chd' });

    expect(job.events.some((e) => e.type === 'game-converted')).toBe(true);
    // bin/cue copied into the scratch dir under their real names, not the
    // job-prefixed tempPath names chdman would otherwise choke on.
    expect(vi.mocked(convertGameToChd).mock.calls[0]?.[1]?.map((r) => r.name)).toEqual([
      'Game (USA).bin',
      'Game (USA).cue',
    ]);

    // node:fs/promises#rename is globally mocked to a no-op elsewhere in
    // this file (vi.mock hoists to module scope regardless of where it's
    // written) — so the move itself isn't exercised here, only that
    // findBrowserFile resolves the converted .chd by gameId+filename once
    // convertGameToChd reports success.
    const found = findBrowserFile(jobId, 'g1', 'Game (USA).chd');
    expect(found).toEqual({
      path: join(tmpdir(), 'flemarr-browser-dl', `${jobId}-Game (USA).chd`),
      filename: 'Game (USA).chd',
    });
  });

  it('falls back to offering the original files individually when browser-target conversion fails', async () => {
    updateSettings({ autoConvertChd: true });
    vi.mocked(getDat).mockReturnValue(DISC_DAT);
    vi.mocked(downloadFile).mockImplementation(async ({ tempPath }) => {
      await mkdir(dirname(tempPath), { recursive: true });
      await writeFile(tempPath, 'raw-bytes');
      return 'done';
    });
    vi.mocked(convertGameToChd).mockResolvedValue({ ok: false, reason: 'createcd failed: boom' });

    const jobId = await startDownload({
      datId: 'dat-001',
      items: discItems,
      target: 'browser',
    });
    await jobEnd(jobId);

    const job = downloadJobs.get(jobId)!;

    const fileReadyRoms = job.events
      .filter((e) => e.type === 'file-ready')
      .map((e) => (e.type === 'file-ready' ? e.romName : undefined))
      .sort();
    expect(fileReadyRoms).toEqual(['Game (USA).bin', 'Game (USA).cue']);

    const failedEvent = job.events.find((e) => e.type === 'game-convert-failed');
    expect(failedEvent).toBeDefined();
    if (failedEvent?.type === 'game-convert-failed') {
      expect(failedEvent.reason).toContain('boom');
    }

    // Originals are still at their tempPaths — never touched by the
    // (mocked) conversion attempt — so the fallback save prompts can
    // actually serve them.
    for (const item of job.items) {
      await access(item.tempPath);
      await rm(item.tempPath, { force: true });
    }
  });

  it('still offers a successful rom individually when a sibling of the same eligible game fails (browser target)', async () => {
    updateSettings({ autoConvertChd: true });
    vi.mocked(getDat).mockReturnValue(DISC_DAT);
    vi.mocked(downloadFile).mockImplementation(async ({ url, tempPath }) => {
      if (url.includes('/cue')) throw new Error('network fail');
      await mkdir(dirname(tempPath), { recursive: true });
      await writeFile(tempPath, 'raw-bytes');
      return 'done';
    });

    const jobId = await startDownload({
      datId: 'dat-001',
      items: discItems,
      target: 'browser',
    });
    await jobEnd(jobId);

    const job = downloadJobs.get(jobId)!;

    // Conversion never even attempts — one rom of the game never finished.
    expect(vi.mocked(convertGameToChd)).not.toHaveBeenCalled();

    // Without the fix, the .bin would stay stuck at file-done forever
    // (already withheld in anticipation of a conversion that's now never
    // coming), with no fallback save prompt ever offered.
    const fileReadyEvents = job.events.filter((e) => e.type === 'file-ready');
    expect(fileReadyEvents).toHaveLength(1);
    expect(fileReadyEvents[0]).toMatchObject({ gameId: 'g1', romName: 'Game (USA).bin' });

    const cueItem = job.items.find((i) => i.romName === 'Game (USA).cue');
    expect(cueItem?.status).toBe('failed');

    const binItem = job.items.find((i) => i.romName === 'Game (USA).bin')!;
    await access(binItem.tempPath);
    await rm(binItem.tempPath, { force: true });
  });

  it('starts the next game downloading while an earlier one is still converting, even at concurrency 1', async () => {
    updateSettings({ autoConvertChd: true, downloaderConcurrency: 1 });
    vi.mocked(getDat).mockReturnValue(DISC_DAT);
    vi.mocked(downloadFile).mockResolvedValue('done');

    let releaseConversion: (() => void) | undefined;
    const conversionGate = new Promise<void>((resolve) => {
      releaseConversion = resolve;
    });
    vi.mocked(convertGameToChd).mockImplementation(async () => {
      await conversionGate;
      return { ok: true, chdPath: join(TMP, 'Game (USA).chd') };
    });

    const jobId = await startDownload({
      datId: 'dat-001',
      items: [
        ...discItems,
        {
          gameId: 'g2',
          romName: 'Other Game (USA).sfc',
          expectedCrc: 'dddddddd',
          sources: [{ url: 'https://x/g2', extractFromZip: false }],
        },
      ],
      target: 'server',
      destinationDir: TMP,
    });

    // g1 (eligible, has a .cue) finishes downloading and hands off to the
    // conversion queue, where it's now stuck on conversionGate. g2 (not in
    // DISC_DAT, so not conversion-eligible) must not need that gate
    // released to get its own download slot and finish.
    await new Promise((r) => setTimeout(r, 100));

    const job = downloadJobs.get(jobId)!;
    const g2Item = job.items.find((i) => i.gameId === 'g2')!;
    expect(g2Item.status).toBe('done');
    // The job itself isn't done yet — g1's conversion is still pending,
    // and the job must wait for it before reporting complete.
    expect(job.status).toBe('running');

    releaseConversion!();
    await new Promise((r) => setTimeout(r, 100));
    expect(downloadJobs.get(jobId)!.status).toBe('done');
  });
});
