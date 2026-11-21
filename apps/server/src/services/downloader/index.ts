import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { assertWithinConfiguredRoots } from '@/lib/fs-safety.js';
import { getSettings } from '@/services/settings/index.js';
import { libraryRoots } from '@/lib/library-root.js';
import type { DownloadRequest, DownloadEvent, DownloadTarget } from '@shared/download.js';
import type { Rom } from '@shared/dat.js';
import { processItem } from './process-item.js';
import type { JobContext } from './process-item.js';
import { cleanupContainerCache } from './container-cache.js';
import {
  emitIndividualFallback,
  getConvertibleRoms,
  maybeConvertGame,
  maybeConvertGameForBrowser,
} from './chd-conversion.js';
import { BROWSER_STAGING_DIR, downloadJobs } from './job-store.js';
import type { DownloadItemState, DownloadJobState } from './job-store.js';

export { downloadJobs, runningDownloads } from './job-store.js';
export type { DownloadJobState } from './job-store.js';

const TEMP_DIR_NAME = '.rom-curator-tmp';

const JOB_RETENTION_MS = 30 * 60 * 1000;

// Deletes a browser-target job's staged files without awaiting the deletions.
function releaseBrowserFiles(job: DownloadJobState): void {
  for (const item of job.items) {
    if (item.status === 'done') void rm(item.tempPath, { force: true }).catch(() => undefined);
  }
  // Same leak, different map: a converted .chd the client never
  // picked up (tab closed before the save prompt, etc.) sits in
  // BROWSER_STAGING_DIR under its own path, not any item's tempPath.
  for (const converted of job.convertedFiles.values()) {
    void rm(converted.path, { force: true }).catch(() => undefined);
  }
}

function evictOldJobs(): void {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [id, job] of downloadJobs) {
    if (job.status !== 'running' && job.completedAt !== undefined && job.completedAt < cutoff) {
      // Browser-target files that were never fetched by the client (tab
      // closed, etc.) would otherwise leak in the OS temp dir forever.
      if (job.target === 'browser') releaseBrowserFiles(job);
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
    controller: new AbortController(),
  }));

  const events: DownloadEvent[] = [];
  const job: DownloadJobState = {
    status: 'running',
    datId,
    destinationDir,
    target,
    items: jobItems,
    events,
    controller,
    containerCache: new Map(),
    convertedFiles: new Map(),
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

  const settings = getSettings();
  const concurrency = settings.downloaderConcurrency;
  const jobSignal = job.controller.signal;
  const inFlight = new Set<Promise<void>>();

  // Grouped by game, not flattened — a concurrency slot is one GAME (all of
  // its roms start together, uncapped), not one file. Without this, a
  // multi-file disc game could occupy several slots by itself, starving
  // unrelated games in the same job of concurrency they should have had.
  // First-seen order preserved, matching job.items' own (request) order.
  const gameIds: string[] = [];
  const itemsByGame = new Map<string, DownloadItemState[]>();
  for (const item of job.items) {
    let list = itemsByGame.get(item.gameId);
    if (!list) {
      list = [];
      itemsByGame.set(item.gameId, list);
      gameIds.push(item.gameId);
    }
    list.push(item);
  }

  // autoConvertChd, either target: which games are eligible (have a .cue in
  // the DAT — see getConvertibleRoms), computed once up front rather than
  // per-item. For browser target, membership here is also what decides
  // file-done (withhold the individual save prompt, wait for the whole
  // game) vs. file-ready (save this file now, as always) in processItem
  // below — a cartridge game must never be gated just because the setting
  // is on.
  const convertEligible = new Map<string, Rom[]>();
  if (settings.autoConvertChd) {
    for (const gameId of gameIds) {
      const roms = getConvertibleRoms(datId, gameId);
      if (roms) convertEligible.set(gameId, roms);
    }
  }

  // Conversion is CPU/disk-bound (chdman), not network — running it inside
  // a game's own download slot would hold that slot for the conversion's
  // full duration, blocking a later game from even starting its download
  // while an earlier one just sits there converting. Queued here instead:
  // a finished game hands its conversion off and its download slot frees
  // immediately, so the next game can start downloading right away.
  // Conversions themselves still run one at a time (chained, not
  // parallel) — chdman's own disk I/O doesn't benefit from overlapping.
  // `.catch` resets the chain to resolved even if a task somehow throws
  // (today's maybeConvertGame*/ convertGameToChd always catch internally
  // and never reject), so one bad conversion can't stall every later one.
  let conversionQueue: Promise<void> = Promise.resolve();
  function enqueueConversion(task: () => Promise<void>): void {
    conversionQueue = conversionQueue.catch(() => undefined).then(task);
  }

  const context: JobContext = { job, jobId, datId, target, destinationDir };

  const runGame = async (gameId: string): Promise<void> => {
    const items = itemsByGame.get(gameId)!;
    const roms = convertEligible.get(gameId);

    await Promise.all(items.map((item) => processItem(context, item, roms !== undefined)));

    if (!roms) return;

    if (items.every((i) => i.status === 'done')) {
      // Handed off to the background queue, not awaited here — see
      // enqueueConversion above for why.
      enqueueConversion(() =>
        target === 'server'
          ? maybeConvertGame(job, gameId, destinationDir!, roms)
          : maybeConvertGameForBrowser(job, jobId, gameId, roms),
      );
      return;
    }

    // A sibling failed or was cancelled — conversion never runs, so every
    // item that DID reach 'done' must still get its own file-ready;
    // otherwise (browser target) it was already swapped for file-done
    // above in anticipation of a conversion that's now never coming, and
    // would be stuck with no save prompt and no fallback at all.
    if (target === 'browser') {
      emitIndividualFallback(
        job,
        jobId,
        items.filter((i) => i.status === 'done'),
      );
    }
  };

  for (const gameId of gameIds) {
    // Not "if aborted, stop queuing" — every game still goes through
    // runGame even after the whole job is cancelled, so each of its items
    // still gets its own file-cancelled event (and the UI can drop it).
    // The per-item fast path at the top of processItem makes this cheap.
    if (inFlight.size >= concurrency) {
      await Promise.race(inFlight);
    }

    const p: Promise<void> = runGame(gameId).finally(() => inFlight.delete(p));
    inFlight.add(p);
  }

  await Promise.all(inFlight);
  // Every download slot is free once this resolves, but a game's own
  // conversion can still be running (or queued) in the background — the
  // job isn't actually finished until that drains too.
  await conversionQueue;
  await cleanupContainerCache(job);

  if (jobSignal.aborted) {
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

  // A converted .chd's filename never matches any one of its game's own
  // roms — checked first, by gameId, rather than against job.items.
  const converted = job.convertedFiles.get(gameId);
  if (converted && converted.filename === romName) return converted;

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
  await cleanupContainerCache(job);

  return true;
}

// Cancels a single item without touching its siblings — the job keeps
// running and finishes normally (status 'done') once every other item
// settles; only this one gets a file-cancelled event.
export async function cancelItem(jobId: string, gameId: string, romName: string): Promise<boolean> {
  const job = downloadJobs.get(jobId);
  if (!job || job.status !== 'running') return false;

  const item = job.items.find((i) => i.gameId === gameId && i.romName === romName);
  if (!item || item.status === 'done' || item.status === 'failed' || item.status === 'cancelled') {
    return false;
  }

  item.controller.abort();
  await rm(item.tempPath, { force: true }).catch(() => undefined);

  return true;
}
