import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { assertWithinRoot, assertWithinConfiguredRoots } from '@/lib/fs-safety.js';
import { getSettings } from '@/services/settings/index.js';
import { downloadFile } from './worker.js';
import type { DownloadRequest, DownloadEvent } from '@shared/download.js';
const TEMP_DIR_NAME = '.rom-curator-tmp';

interface DownloadItemState {
  gameId: string;
  romName: string;
  expectedCrc: string;
  downloadUrl: string;
  status: 'queued' | 'downloading' | 'done' | 'failed';
  tempPath: string;
}

export interface DownloadJobState {
  status: 'running' | 'cancelled' | 'done';
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
      downloadJobs.delete(id);
    }
  }
}

export async function startDownload(request: DownloadRequest): Promise<string> {
  const { items, destinationDir } = request;

  // Configured roots only (ARCHITECTURE.md) — refuse destinations outside settings.systemPaths
  assertWithinConfiguredRoots(destinationDir, Object.values(getSettings().systemPaths));

  evictOldJobs();
  const jobId = randomUUID();
  const controller = new AbortController();

  const jobItems: DownloadItemState[] = items.map((item) => ({
    ...item,
    status: 'queued',
    tempPath: join(destinationDir, TEMP_DIR_NAME, `${jobId}-${basename(item.romName)}`),
  }));

  const events: DownloadEvent[] = [];
  const job: DownloadJobState = { status: 'running', items: jobItems, events, controller };
  downloadJobs.set(jobId, job);

  runQueue(jobId, destinationDir).catch(() => undefined);

  return jobId;
}

async function runQueue(jobId: string, destinationDir: string): Promise<void> {
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

    try {
      const result = await downloadFile({
        url: item.downloadUrl,
        tempPath: item.tempPath,
        expectedCrc: item.expectedCrc,
        signal,
        onProgress: (bytesDownloaded, totalBytes) => {
          const now = Date.now();
          const isLast = totalBytes > 0 && bytesDownloaded >= totalBytes;
          if (!isLast && now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
          lastProgressAt = now;
          job.events.push({ type: 'progress', gameId: item.gameId, bytesDownloaded, totalBytes });
        },
      });

      if (result === 'done') {
        const dest = join(destinationDir, item.romName);
        assertWithinRoot(dest, destinationDir);
        await rename(item.tempPath, dest);
        item.status = 'done';
        job.events.push({ type: 'file-done', gameId: item.gameId, romName: item.romName });
      } else if (result === 'cancelled') {
        item.status = 'failed';
      } else {
        item.status = 'failed';
        const reason = result === 'crc-mismatch' ? 'CRC mismatch' : 'Download failed';
        job.events.push({
          type: 'file-failed',
          gameId: item.gameId,
          romName: item.romName,
          reason,
        });
      }
    } catch (err) {
      item.status = 'failed';
      job.events.push({
        type: 'file-failed',
        gameId: item.gameId,
        romName: item.romName,
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
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

export async function cancelJob(jobId: string): Promise<boolean> {
  const job = downloadJobs.get(jobId);
  if (!job || job.status !== 'running') return false;

  job.controller.abort();

  // Best-effort cleanup of temp files
  const tempPaths = job.items.map((i) => i.tempPath);
  await Promise.all(tempPaths.map((p) => rm(p, { force: true }).catch(() => undefined)));

  return true;
}
