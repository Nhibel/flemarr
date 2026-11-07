import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { assertWithinRoot, assertWithinConfiguredRoots } from '@/lib/fs-safety.js';
import { getSettings } from '@/services/settings/index.js';
import { libraryRoots } from '@/lib/library-root.js';
import { downloadFile } from './worker.js';
import type { WorkerResult } from './worker.js';
import { recordDownload } from './history.js';
import { logger } from '@/lib/logger.js';
import type { DownloadRequest, DownloadEvent, DownloadTarget } from '@shared/download.js';
const TEMP_DIR_NAME = '.rom-curator-tmp';
// Browser-target files are staged here (outside any library root — they
// never get placed, only served once and then deleted).
const BROWSER_STAGING_DIR = join(tmpdir(), 'rom-curator-browser-dl');

interface DownloadItemState {
  gameId: string;
  romName: string;
  expectedCrc: string;
  downloadUrls: string[];
  extractFromZip: boolean;
  status: 'queued' | 'downloading' | 'done' | 'failed';
  tempPath: string;
}

export interface DownloadJobState {
  status: 'running' | 'cancelled' | 'done';
  target: DownloadTarget;
  items: DownloadItemState[];
  events: DownloadEvent[];
  controller: AbortController;
  completedAt?: number;
}

export const downloadJobs = new Map<string, DownloadJobState>();

const JOB_RETENTION_MS = 30 * 60 * 1000;
// One progress event per network chunk would grow job.events unbounded on
// multi-GB files (and get replayed in full to every SSE client) — throttle.
const PROGRESS_THROTTLE_MS = 250;

function evictOldJobs(): void {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [id, job] of downloadJobs) {
    if (job.status !== 'running' && job.completedAt !== undefined && job.completedAt < cutoff) {
      // Browser-target files that were never fetched by the client (tab
      // closed, etc.) would otherwise leak in the OS temp dir forever.
      if (job.target === 'browser') {
        for (const item of job.items) {
          if (item.status === 'done')
            void rm(item.tempPath, { force: true }).catch(() => undefined);
        }
      }
      downloadJobs.delete(id);
    }
  }
}

export async function startDownload(request: DownloadRequest): Promise<string> {
  const { datId, items, target, destinationDir } = request;

  if (target === 'server') {
    // Configured roots only (ARCHITECTURE.md) — refuse destinations outside
    // the library root (ROMS_ROOT) or, when unset, the configured system paths.
    assertWithinConfiguredRoots(destinationDir!, libraryRoots());
  }

  evictOldJobs();
  const jobId = randomUUID();
  const controller = new AbortController();

  const stagingDir =
    target === 'browser' ? BROWSER_STAGING_DIR : join(destinationDir!, TEMP_DIR_NAME);
  const jobItems: DownloadItemState[] = items.map((item) => ({
    ...item,
    status: 'queued',
    tempPath: join(stagingDir, `${jobId}-${basename(item.romName)}`),
  }));

  const events: DownloadEvent[] = [];
  const job: DownloadJobState = {
    status: 'running',
    target,
    items: jobItems,
    events,
    controller,
  };
  downloadJobs.set(jobId, job);

  runQueue(jobId, datId, target, destinationDir).catch(() => undefined);

  return jobId;
}

async function runQueue(
  jobId: string,
  datId: string,
  target: DownloadTarget,
  destinationDir: string | undefined,
): Promise<void> {
  const job = downloadJobs.get(jobId);
  if (!job) return;

  const concurrency = getSettings().downloaderConcurrency;
  const { signal } = job.controller;
  const queue = [...job.items];
  const inFlight = new Set<Promise<void>>();

  const processItem = async (item: DownloadItemState): Promise<void> => {
    if (signal.aborted) return;

    item.status = 'downloading';
    let lastProgressAt = 0;

    const onProgress = (bytesDownloaded: number, totalBytes: number): void => {
      const now = Date.now();
      const isLast = totalBytes > 0 && bytesDownloaded >= totalBytes;
      if (!isLast && now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
      lastProgressAt = now;
      job.events.push({
        type: 'progress',
        gameId: item.gameId,
        romName: item.romName,
        bytesDownloaded,
        totalBytes,
      });
    };

    // Try candidate URLs in order. HTTP/network failures fall through to the
    // next source; done, cancelled and crc-mismatch are final (a CRC mismatch
    // means a bad source, not a glitch — per docs/archive-org-strategy.md).
    let result: WorkerResult | 'exhausted' = 'exhausted';
    let lastError = '';
    for (const url of item.downloadUrls) {
      if (signal.aborted) {
        result = 'cancelled';
        break;
      }
      try {
        logger.info({ romName: item.romName, url }, 'download started');
        result = await downloadFile({
          url,
          tempPath: item.tempPath,
          expectedCrc: item.expectedCrc,
          extractFromZip: item.extractFromZip,
          signal,
          onProgress,
        });
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn({ romName: item.romName, url, error: lastError }, 'download source failed');
        result = 'exhausted';
      }
    }

    if (result === 'done' && target === 'browser') {
      // Stays at item.tempPath — the route streams it to the browser on
      // request, then deletes it. Never placed anywhere on this host.
      item.status = 'done';
      logger.info({ romName: item.romName }, 'download ready for browser pickup');
      job.events.push({
        type: 'file-ready',
        gameId: item.gameId,
        romName: item.romName,
        downloadUrl: `/api/downloads/${jobId}/items/${encodeURIComponent(item.gameId)}/${encodeURIComponent(item.romName)}`,
      });
      recordDownload({
        gameId: item.gameId,
        romName: item.romName,
        datId,
        destination: '<browser>',
        expectedCrc: item.expectedCrc,
        status: 'done',
      });
      return;
    }

    if (result === 'done' && target === 'server') {
      try {
        const dest = join(destinationDir!, item.romName);
        assertWithinRoot(dest, destinationDir!);
        await rename(item.tempPath, dest);
        item.status = 'done';
        logger.info({ romName: item.romName, dest }, 'download done');
        job.events.push({ type: 'file-done', gameId: item.gameId, romName: item.romName });
        recordDownload({
          gameId: item.gameId,
          romName: item.romName,
          datId,
          destination: dest,
          expectedCrc: item.expectedCrc,
          status: 'done',
        });
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        result = 'exhausted';
      }
    }

    if (result === 'cancelled') {
      item.status = 'failed';
      return;
    }

    item.status = 'failed';
    const reason =
      result === 'crc-mismatch'
        ? 'CRC mismatch'
        : `Download failed${lastError ? ` (${lastError})` : ''}`;
    logger.warn({ romName: item.romName, reason }, 'download failed');
    job.events.push({ type: 'file-failed', gameId: item.gameId, romName: item.romName, reason });
    recordDownload({
      gameId: item.gameId,
      romName: item.romName,
      datId,
      destination: target === 'browser' ? '<browser>' : join(destinationDir!, item.romName),
      expectedCrc: item.expectedCrc,
      status: 'failed',
      errorMessage: reason,
    });
  };

  for (const item of queue) {
    if (signal.aborted) break;

    if (inFlight.size >= concurrency) {
      await Promise.race(inFlight);
    }

    const p: Promise<void> = processItem(item).finally(() => inFlight.delete(p));
    inFlight.add(p);
  }

  await Promise.all(inFlight);

  if (signal.aborted) {
    job.status = 'cancelled';
    job.events.push({ type: 'cancelled' });
  } else {
    job.status = 'done';
    job.events.push({ type: 'complete' });
  }
  job.completedAt = Date.now();
}

/**
 * Looks up a validated, browser-target file ready for the client to save.
 * Returns its on-disk path and the canonical ROM filename, or null if the
 * job/item doesn't exist, isn't browser-target, or isn't done yet.
 */
export function findBrowserFile(
  jobId: string,
  gameId: string,
  romName: string,
): { path: string; filename: string } | null {
  const job = downloadJobs.get(jobId);
  if (!job || job.target !== 'browser') return null;
  const item = job.items.find((i) => i.gameId === gameId && i.romName === romName);
  if (!item || item.status !== 'done') return null;
  return { path: item.tempPath, filename: item.romName };
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const job = downloadJobs.get(jobId);
  if (!job || job.status !== 'running') return false;

  job.controller.abort();

  // Best-effort cleanup of temp files
  const tempPaths = job.items.map((i) => i.tempPath);
  await Promise.all(tempPaths.map((p) => rm(p, { force: true }).catch(() => undefined)));

  return true;
}
