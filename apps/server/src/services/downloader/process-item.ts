import { rename } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { assertWithinRoot } from '@/lib/fs-safety.js';
import { logTarget, networkErrorReason } from '@/lib/logged-fetch.js';
import { logger } from '@/lib/logger.js';
import type { DownloadSource, DownloadTarget } from '@shared/download.js';
import { downloadFile, extractContainerEntry } from './worker.js';
import type { WorkerResult } from './worker.js';
import { recordDownload } from './history.js';
import { abortSignal, getOrFetchContainer } from './container-cache.js';
import { browserFileUrl } from './job-store.js';
import type { DownloadItemState, DownloadJobState } from './job-store.js';

// One progress event per network chunk would grow job.events unbounded on
// multi-GB files (and get replayed in full to every SSE client) — throttle.
const PROGRESS_THROTTLE_MS = 250;

/** What every item of a job shares: the job itself and where its files go. */
export interface JobContext {
  job: DownloadJobState;
  jobId: string;
  datId: string;
  target: DownloadTarget;
  /** Set for the server target only (startDownload checks it). */
  destinationDir: string | undefined;
}

type FetchResult = WorkerResult | 'exhausted';

type ProgressCallback = (bytesDownloaded: number, totalBytes: number) => void;

/**
 * Downloads one item from its candidate sources, then settles it: ready for
 * the browser, placed in the library, cancelled or failed — each with its
 * own event and, except for a cancel, a history record.
 */
export async function processItem(
  context: JobContext,
  item: DownloadItemState,
  eligible: boolean,
): Promise<void> {
  const { job, target } = context;
  // Aborts if EITHER this item's own controller fires (cancelItem) or the
  // job's shared one does (cancelJob, "cancel everything") — one signal
  // for both cancellation paths, so the rest of this function doesn't
  // need to know which one happened.
  const signal = AbortSignal.any([job.controller.signal, item.controller.signal]);
  if (signal.aborted) {
    // Covers both "still queued, never started" and "was downloading,
    // now aborted" — either way, nothing ran, so there's nothing to clean
    // up beyond the event that tells the UI to drop this row.
    markCancelled(context, item);
    return;
  }

  item.status = 'downloading';
  const fetched = await fetchFromSources(context, item, signal, throttledProgress(job, item));
  let result = fetched.result;
  let lastError = fetched.lastError;

  if (result === 'done' && target === 'browser') {
    finishForBrowser(context, item, eligible);
    return;
  }

  if (result === 'done' && target === 'server') {
    const placeError = await placeOnServer(context, item);
    if (placeError === null) return;
    lastError = placeError;
    result = 'exhausted';
  }

  if (result === 'cancelled') {
    markCancelled(context, item);
    return;
  }

  failItem(context, item, failureReason(result, lastError));
}

/** The reason shown for a failed item: a CRC mismatch, or the last source's error. */
export function failureReason(result: FetchResult, lastError: string): string {
  if (result === 'crc-mismatch') return 'CRC mismatch';
  if (lastError === '') return 'Download failed';
  return `Download failed (${lastError})`;
}

function throttledProgress(job: DownloadJobState, item: DownloadItemState): ProgressCallback {
  let lastProgressAt = 0;
  return (bytesDownloaded, totalBytes) => {
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
}

// Try candidate sources in order. HTTP/network failures fall through to
// the next one; done, cancelled and crc-mismatch are final (a CRC
// mismatch means a bad source, not a glitch — per
// docs/archive-org-strategy.md).
async function fetchFromSources(
  { job, jobId }: JobContext,
  item: DownloadItemState,
  signal: AbortSignal,
  onProgress: ProgressCallback,
): Promise<{ result: FetchResult; lastError: string }> {
  let lastError = '';
  for (const source of item.sources) {
    if (signal.aborted) return { result: 'cancelled', lastError };
    try {
      logger.info(
        { jobId, romName: item.romName, target: logTarget(source.url) },
        'download started',
      );
      const result = await fetchFromSource(job, item, source, signal, onProgress);
      return { result, lastError };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.warn(
        {
          jobId,
          romName: item.romName,
          target: logTarget(source.url),
          error: networkErrorReason(err),
        },
        'download source failed',
      );
    }
  }
  return { result: 'exhausted', lastError };
}

function fetchFromSource(
  job: DownloadJobState,
  item: DownloadItemState,
  source: DownloadSource,
  signal: AbortSignal,
  onProgress: ProgressCallback,
): Promise<WorkerResult> {
  if (source.innerPath !== undefined) {
    return fetchViaContainer(job, item, source.url, source.innerPath, signal, onProgress);
  }
  return downloadFile({
    url: source.url,
    tempPath: item.tempPath,
    expectedCrc: item.expectedCrc,
    extractFromZip: source.extractFromZip,
    signal,
    onProgress,
  });
}

// Archive-container fast path: fetch the whole container once
// (shared across every rom of the same game that needs it — see
// getOrFetchContainer), then extract this rom's own entry locally.
// Raced against this item's own signal at both steps — see
// abortSignal's comment for why neither step checks it on its own.
// `release()` (in the finally below) drops this item's claim on
// the shared container once it's done with it either way — once
// nothing claims it any more, the fetch itself is aborted instead
// of running to completion in the background for no one.
async function fetchViaContainer(
  job: DownloadJobState,
  item: DownloadItemState,
  containerUrl: string,
  innerPath: string,
  signal: AbortSignal,
  onProgress: ProgressCallback,
): Promise<WorkerResult> {
  const { promise: containerPromise, release } = getOrFetchContainer(
    job,
    containerUrl,
    job.controller.signal,
    dirname(item.tempPath),
    onProgress,
  );
  try {
    const containerPath = await Promise.race([containerPromise, abortSignal(signal)]);
    if (containerPath === 'aborted') return 'cancelled';

    job.events.push({ type: 'file-extracting', gameId: item.gameId, romName: item.romName });
    const extracted = await Promise.race([
      extractContainerEntry({
        containerPath,
        innerPath,
        outputPath: item.tempPath,
        expectedCrc: item.expectedCrc,
      }),
      abortSignal(signal),
    ]);
    return extracted === 'aborted' ? 'cancelled' : extracted;
  } finally {
    release();
  }
}

function finishForBrowser(context: JobContext, item: DownloadItemState, eligible: boolean): void {
  const { job, jobId, datId } = context;
  // Stays at item.tempPath — the route streams it to the browser on
  // request, then deletes it. Never placed anywhere on this host.
  item.status = 'done';
  logger.info({ jobId, romName: item.romName }, 'download ready for browser pickup');
  recordDownload({
    gameId: item.gameId,
    romName: item.romName,
    datId,
    destination: '<browser>',
    expectedCrc: item.expectedCrc,
    status: 'done',
  });

  if (eligible) {
    // file-done only marks this row's progress complete; the
    // individual browser-save prompt is withheld so the bin and cue
    // never each trigger their own download — runGame (in runQueue)
    // offers the single .chd, or falls back to this item's own
    // file-ready, once every rom of the game has settled.
    job.events.push({ type: 'file-done', gameId: item.gameId, romName: item.romName });
    return;
  }

  job.events.push({
    type: 'file-ready',
    gameId: item.gameId,
    romName: item.romName,
    downloadUrl: browserFileUrl(jobId, item.gameId, item.romName),
  });
}

/** Moves the validated file into the library. Null on success, else the error message. */
async function placeOnServer(context: JobContext, item: DownloadItemState): Promise<string | null> {
  const { job, datId } = context;
  const destinationDir = context.destinationDir!;
  try {
    const dest = join(destinationDir, basename(item.romName));
    assertWithinRoot(dest, destinationDir);
    await rename(item.tempPath, dest);
    item.status = 'done';
    logger.info({ jobId: context.jobId, romName: item.romName, dest }, 'download done');
    job.events.push({ type: 'file-done', gameId: item.gameId, romName: item.romName });
    recordDownload({
      gameId: item.gameId,
      romName: item.romName,
      datId,
      destination: dest,
      expectedCrc: item.expectedCrc,
      status: 'done',
    });
    return null;
  } catch (err) {
    logger.error(
      { jobId: context.jobId, romName: item.romName, destinationDir, err },
      'could not place the file in the library',
    );
    return err instanceof Error ? err.message : String(err);
  }
}

function markCancelled({ job, jobId }: JobContext, item: DownloadItemState): void {
  logger.info({ jobId, romName: item.romName }, 'download cancelled');
  item.status = 'cancelled';
  job.events.push({ type: 'file-cancelled', gameId: item.gameId, romName: item.romName });
}

function failItem(context: JobContext, item: DownloadItemState, reason: string): void {
  const { job, datId, target } = context;
  item.status = 'failed';
  logger.warn({ jobId: context.jobId, romName: item.romName, reason }, 'download failed');
  job.events.push({ type: 'file-failed', gameId: item.gameId, romName: item.romName, reason });
  const destination =
    target === 'browser' ? '<browser>' : join(context.destinationDir!, basename(item.romName));
  recordDownload({
    gameId: item.gameId,
    romName: item.romName,
    datId,
    destination,
    expectedCrc: item.expectedCrc,
    status: 'failed',
    errorMessage: reason,
  });
}
