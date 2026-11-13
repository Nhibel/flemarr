import { randomUUID } from 'node:crypto';
import { rename, rm, mkdir, copyFile } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { assertWithinRoot, assertWithinConfiguredRoots } from '@/lib/fs-safety.js';
import { getSettings } from '@/services/settings/index.js';
import { libraryRoots } from '@/lib/library-root.js';
import { downloadFile, extractContainerEntry } from './worker.js';
import type { WorkerResult } from './worker.js';
import { recordDownload } from './history.js';
import { convertGameToChd } from './chd.js';
import { getDat } from '@/services/dat/store.js';
import { logger } from '@/lib/logger.js';
import type {
  DownloadRequest,
  DownloadEvent,
  DownloadTarget,
  DownloadSource,
} from '@shared/download.js';
import type { Rom } from '@shared/dat.js';
const TEMP_DIR_NAME = '.rom-curator-tmp';
// Browser-target files are staged here (outside any library root — they
// never get placed, only served once and then deleted).
const BROWSER_STAGING_DIR = join(tmpdir(), 'rom-curator-browser-dl');

interface DownloadItemState {
  gameId: string;
  romName: string;
  expectedCrc: string;
  // Ordered candidates — see downloadSourceSchema. A candidate with
  // innerPath set is an archive-container fast path (fetch the whole
  // container via getOrFetchContainer, then extractContainerEntry); others
  // go straight through downloadFile as before.
  sources: DownloadSource[];
  status: 'queued' | 'downloading' | 'done' | 'failed' | 'cancelled';
  tempPath: string;
  // Own controller, separate from the job's — lets one item be cancelled
  // without aborting its siblings. Combined with the job's own signal (see
  // processItem) so the existing "cancel everything" action still works.
  controller: AbortController;
}

export interface DownloadJobState {
  status: 'running' | 'cancelled' | 'done';
  target: DownloadTarget;
  items: DownloadItemState[];
  events: DownloadEvent[];
  controller: AbortController;
  completedAt?: number;
  // Several roms of the same game can share one archive-container (e.g. a
  // disc's .bin and .cue both live in the same per-game .7z) — dedup'd here
  // by container URL so it's only fetched once per job.
  // `listeners` fans the one real download's progress out to every item
  // waiting on it — a per-game .7z/.zip is itself multiple hundred MB, and
  // without this nothing at all showed in the UI until the whole thing
  // finished (looked exactly like the download never started).
  // `refCount`/`controller`: once every item that needed this container has
  // settled (done, failed, or cancelled — see getOrFetchContainer's
  // `release`), the fetch itself is aborted if it's still running. Without
  // this, cancelling every item sharing a container left the real download
  // running to completion in the background regardless, which also blocked
  // the job from ever reaching 'done' (cleanupContainerCache awaits it at
  // job end) — the job-level "Annuler" button stayed up until a multi-
  // hundred-MB download finished on its own, long after every row it was
  // for had already disappeared.
  containerCache: Map<
    string,
    {
      promise: Promise<string>;
      listeners: Set<(bytesDownloaded: number, totalBytes: number) => void>;
      controller: AbortController;
      refCount: number;
    }
  >;
  // Browser-target CHD conversions only: a game's raw .bin/.cue are never
  // placed anywhere findBrowserFile already knows to look (see
  // maybeConvertGameForBrowser) — the resulting .chd's own path+filename is
  // recorded here, keyed by gameId, so findBrowserFile can serve it.
  convertedFiles: Map<string, { path: string; filename: string }>;
}

export const downloadJobs = new Map<string, DownloadJobState>();

const JOB_RETENTION_MS = 30 * 60 * 1000;
// One progress event per network chunk would grow job.events unbounded on
// multi-GB files (and get replayed in full to every SSE client) — throttle.
const PROGRESS_THROTTLE_MS = 250;

// Resolves once the signal aborts — used to race a per-item cancel against
// the archive-container fast path's own operations below, neither of which
// otherwise ever check this item's signal mid-flight: getOrFetchContainer
// deliberately uses the job's signal, not this item's own, since the fetch
// may still be needed by sibling roms; extractContainerEntry takes no
// signal at all. Without this, cancelling one item that's waiting on (or
// extracting from) an archive-container had no effect at all until that
// operation finished on its own.
function abortSignal(signal: AbortSignal): Promise<'aborted'> {
  if (signal.aborted) return Promise.resolve('aborted');
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve('aborted'), { once: true });
  });
}

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
        // Same leak, different map: a converted .chd the client never
        // picked up (tab closed before the save prompt, etc.) sits in
        // BROWSER_STAGING_DIR under its own path, not any item's tempPath.
        for (const converted of job.convertedFiles.values()) {
          void rm(converted.path, { force: true }).catch(() => undefined);
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
    controller: new AbortController(),
  }));

  const events: DownloadEvent[] = [];
  const job: DownloadJobState = {
    status: 'running',
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
  const queue = [...job.items];
  const inFlight = new Set<Promise<void>>();

  // autoConvertChd, either target: counts down as each rom of an eligible
  // game (one with a .cue in the DAT — see getConvertibleRoms) reaches
  // 'done'. Only eligible games are tracked at all: for browser target,
  // whether a gameId is a key here is also what decides file-done
  // (withhold the individual save prompt, wait for the whole game) vs.
  // file-ready (save this file now, as always) in processItem below — a
  // cartridge game must never be silently gated just because the setting
  // is on. A game's CHD conversion only ever triggers once the count hits
  // zero (every rom downloaded successfully) — a failed or cancelled
  // sibling just means it never does, leaving the originals as plain
  // bin/cue (safe default, never a half-converted game).
  const remainingRomsByGame = new Map<string, number>();
  if (settings.autoConvertChd) {
    for (const gameId of new Set(job.items.map((i) => i.gameId))) {
      if (getConvertibleRoms(datId, gameId) !== undefined) remainingRomsByGame.set(gameId, 0);
    }
    for (const item of job.items) {
      const count = remainingRomsByGame.get(item.gameId);
      if (count !== undefined) remainingRomsByGame.set(item.gameId, count + 1);
    }
  }

  const processItem = async (item: DownloadItemState): Promise<void> => {
    // Aborts if EITHER this item's own controller fires (cancelItem) or the
    // job's shared one does (cancelJob, "cancel everything") — one signal
    // for both cancellation paths, so the rest of this function doesn't
    // need to know which one happened.
    const signal = AbortSignal.any([jobSignal, item.controller.signal]);
    if (signal.aborted) {
      // Covers both "still queued, never started" and "was downloading,
      // now aborted" — either way, nothing ran, so there's nothing to clean
      // up beyond the event that tells the UI to drop this row.
      item.status = 'cancelled';
      job.events.push({ type: 'file-cancelled', gameId: item.gameId, romName: item.romName });
      return;
    }

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

    // Try candidate sources in order. HTTP/network failures fall through to
    // the next one; done, cancelled and crc-mismatch are final (a CRC
    // mismatch means a bad source, not a glitch — per
    // docs/archive-org-strategy.md).
    let result: WorkerResult | 'exhausted' = 'exhausted';
    let lastError = '';
    for (const src of item.sources) {
      if (signal.aborted) {
        result = 'cancelled';
        break;
      }
      try {
        logger.info({ romName: item.romName, url: src.url }, 'download started');
        if (src.innerPath !== undefined) {
          // Archive-container fast path: fetch the whole container once
          // (shared across every rom of the same game that needs it — see
          // getOrFetchContainer), then extract this rom's own entry locally.
          // Raced against this item's own signal at both steps — see
          // abortSignal's comment for why neither step checks it on its own.
          // `release()` (in the finally below) drops this item's claim on
          // the shared container once it's done with it either way — once
          // nothing claims it any more, the fetch itself is aborted instead
          // of running to completion in the background for no one.
          const { promise: containerPromise, release } = getOrFetchContainer(
            job,
            src.url,
            jobSignal,
            dirname(item.tempPath),
            onProgress,
          );
          try {
            const containerResult = await Promise.race([containerPromise, abortSignal(signal)]);
            if (containerResult === 'aborted') {
              result = 'cancelled';
            } else {
              job.events.push({
                type: 'file-extracting',
                gameId: item.gameId,
                romName: item.romName,
              });
              const extractResult = await Promise.race([
                extractContainerEntry({
                  containerPath: containerResult,
                  innerPath: src.innerPath,
                  outputPath: item.tempPath,
                  expectedCrc: item.expectedCrc,
                }),
                abortSignal(signal),
              ]);
              result = extractResult === 'aborted' ? 'cancelled' : extractResult;
            }
          } finally {
            release();
          }
        } else {
          result = await downloadFile({
            url: src.url,
            tempPath: item.tempPath,
            expectedCrc: item.expectedCrc,
            extractFromZip: src.extractFromZip,
            signal,
            onProgress,
          });
        }
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn(
          { romName: item.romName, url: src.url, error: lastError },
          'download source failed',
        );
        result = 'exhausted';
      }
    }

    if (result === 'done' && target === 'browser') {
      // Stays at item.tempPath — the route streams it to the browser on
      // request, then deletes it. Never placed anywhere on this host.
      item.status = 'done';
      logger.info({ romName: item.romName }, 'download ready for browser pickup');
      recordDownload({
        gameId: item.gameId,
        romName: item.romName,
        datId,
        destination: '<browser>',
        expectedCrc: item.expectedCrc,
        status: 'done',
      });

      const remaining = remainingRomsByGame.get(item.gameId);
      if (remaining !== undefined) {
        // Eligible game, still waiting on sibling roms (or this is the
        // last one) — file-done only marks this row's progress complete;
        // the individual browser-save prompt is withheld so the bin and
        // cue never each trigger their own download (see
        // maybeConvertGameForBrowser, which offers the single .chd once
        // every rom is in).
        job.events.push({ type: 'file-done', gameId: item.gameId, romName: item.romName });
        remainingRomsByGame.set(item.gameId, remaining - 1);
        if (remaining - 1 === 0) {
          await maybeConvertGameForBrowser(job, jobId, datId, item.gameId);
        }
        return;
      }

      job.events.push({
        type: 'file-ready',
        gameId: item.gameId,
        romName: item.romName,
        downloadUrl: `/api/downloads/${jobId}/items/${encodeURIComponent(item.gameId)}/${encodeURIComponent(item.romName)}`,
      });
      return;
    }

    if (result === 'done' && target === 'server') {
      try {
        const dest = join(destinationDir!, basename(item.romName));
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

        const remaining = remainingRomsByGame.get(item.gameId);
        if (remaining !== undefined) {
          remainingRomsByGame.set(item.gameId, remaining - 1);
          if (remaining - 1 === 0) {
            await maybeConvertGame(job, datId, item.gameId, destinationDir!);
          }
        }
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        result = 'exhausted';
      }
    }

    if (result === 'cancelled') {
      item.status = 'cancelled';
      job.events.push({ type: 'file-cancelled', gameId: item.gameId, romName: item.romName });
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
      destination:
        target === 'browser' ? '<browser>' : join(destinationDir!, basename(item.romName)),
      expectedCrc: item.expectedCrc,
      status: 'failed',
      errorMessage: reason,
    });
  };

  for (const item of queue) {
    // Not "if aborted, stop queuing" — every item still goes through
    // processItem even after the whole job is cancelled, so each one still
    // gets its own file-cancelled event (and the UI can drop it). The
    // per-item fast path at the top of processItem makes this cheap.
    if (inFlight.size >= concurrency) {
      await Promise.race(inFlight);
    }

    const p: Promise<void> = processItem(item).finally(() => inFlight.delete(p));
    inFlight.add(p);
  }

  await Promise.all(inFlight);
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

// Only games with a .cue among the DAT's own roms (disc systems) are
// eligible for CHD conversion — everything else (cartridge systems) returns
// undefined, a silent no-op rather than an error, for both target types.
function getConvertibleRoms(datId: string, gameId: string): Rom[] | undefined {
  const dat = getDat(datId);
  const game = dat?.games.find((g) => g.id === gameId);
  if (!game) return undefined;
  const roms = game.roms.filter((r) => r.crc !== undefined);
  if (!roms.some((r) => r.name.toLowerCase().endsWith('.cue'))) return undefined;
  return roms;
}

// Called once every rom of `gameId` in this job has reached 'done' (see
// runQueue's remainingRomsByGame).
async function maybeConvertGame(
  job: DownloadJobState,
  datId: string,
  gameId: string,
  destinationDir: string,
): Promise<void> {
  const roms = getConvertibleRoms(datId, gameId);
  if (!roms) return;

  job.events.push({ type: 'game-converting', gameId });
  const result = await convertGameToChd(destinationDir, roms);
  if (result.ok) {
    job.events.push({ type: 'game-converted', gameId });
  } else {
    job.events.push({
      type: 'game-convert-failed',
      gameId,
      reason: result.reason ?? 'unknown error',
    });
  }
}

// Browser-target counterpart to maybeConvertGame. Unlike server-target,
// these roms were never renamed to canonical names in a shared folder — each
// item sits at its own job-prefixed tempPath (see startDownload) — and
// chdman needs the .cue's internally-referenced filenames to match real
// files on disk. So: copy (not move, to keep the per-item fallback intact
// on any failure) each item into a scratch dir under its real basename,
// convert there, then move the resulting .chd into the same flat staging
// dir every other browser item uses, so findBrowserFile/the download route
// can serve and clean it up exactly like any other browser-target file.
async function maybeConvertGameForBrowser(
  job: DownloadJobState,
  jobId: string,
  datId: string,
  gameId: string,
): Promise<void> {
  const gameItems = job.items.filter((i) => i.gameId === gameId && i.status === 'done');

  const fallbackToIndividualSaves = (): void => {
    for (const item of gameItems) {
      job.events.push({
        type: 'file-ready',
        gameId: item.gameId,
        romName: item.romName,
        downloadUrl: `/api/downloads/${jobId}/items/${encodeURIComponent(item.gameId)}/${encodeURIComponent(item.romName)}`,
      });
    }
  };

  const roms = getConvertibleRoms(datId, gameId);
  if (!roms) {
    fallbackToIndividualSaves();
    return;
  }

  job.events.push({ type: 'game-converting', gameId });

  const scratchDir = join(tmpdir(), `rom-curator-chd-browser-${randomUUID()}`);
  try {
    await mkdir(scratchDir, { recursive: true });
    for (const item of gameItems) {
      await copyFile(item.tempPath, join(scratchDir, basename(item.romName)));
    }

    const result = await convertGameToChd(scratchDir, roms);
    if (!result.ok || !result.chdPath) {
      const reason = result.reason ?? 'unknown error';
      logger.warn({ gameId, reason }, 'browser-target CHD conversion failed, falling back');
      job.events.push({ type: 'game-convert-failed', gameId, reason });
      fallbackToIndividualSaves();
      return;
    }

    const filename = basename(result.chdPath);
    const finalPath = join(BROWSER_STAGING_DIR, `${jobId}-${filename}`);
    await mkdir(BROWSER_STAGING_DIR, { recursive: true });
    await rename(result.chdPath, finalPath);

    job.convertedFiles.set(gameId, { path: finalPath, filename });
    job.events.push({ type: 'game-converted', gameId });
    job.events.push({
      type: 'file-ready',
      gameId,
      romName: filename,
      downloadUrl: `/api/downloads/${jobId}/items/${encodeURIComponent(gameId)}/${encodeURIComponent(filename)}`,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn(
      { gameId, scratchDir, reason },
      'browser-target CHD conversion threw, falling back',
    );
    job.events.push({ type: 'game-convert-failed', gameId, reason });
    fallbackToIndividualSaves();
  } finally {
    // On success the .chd was already moved out above; this only ever
    // removes the (now-empty, or never-fully-populated on failure) scratch
    // dir itself — the originals it held were copies, never the real
    // tempPaths, so there's nothing here that fallbackToIndividualSaves
    // still needs.
    await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// A container shared by several roms (see getOrFetchContainer) is job-scoped,
// not any single item's own tempPath — cleaned up once, here, rather than
// refcounted per item. By the time this runs (after every item has settled),
// any container still fetching has already had its last claim released,
// which aborts it — so this mostly awaits already-aborted/finished fetches,
// not a full in-progress download.
async function cleanupContainerCache(job: DownloadJobState): Promise<void> {
  const settled = await Promise.allSettled(
    [...job.containerCache.values()].map((entry) => entry.promise),
  );
  await Promise.all(
    settled
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => rm(r.value, { force: true }).catch(() => undefined)),
  );
}

// Fetches a whole archive container once per job, sharing it across every
// rom that needs an entry from it (e.g. a disc's .bin and .cue in the same
// per-game .7z). The check-then-set on containerCache is synchronous — no
// `await` in between — so concurrent callers for the same URL never race
// into two fetches.
//
// A per-game archive can be hundreds of MB — every item waiting on this
// same fetch registers its own onProgress as a listener, so every one of
// them (not just whichever item happened to trigger the fetch) sees real
// progress while the shared container downloads, instead of nothing at all
// until it's done (which looked exactly like the download never started).
//
// Returns a `release()` the caller must call (in a finally) once it's done
// with the container either way. refCount tracks how many items still
// claim it; once it hits zero the fetch is aborted if still running —
// without this, cancelling every item sharing a container left the real
// download running to completion in the background regardless, which also
// blocked the job from ever finishing (cleanupContainerCache awaits it at
// job end): the job-level "Annuler" button stayed up long after every row
// it was for had already disappeared. The container's own controller still
// cascades from the job's signal (whole-job cancel keeps working), but
// cancelling one item must not aim it at siblings still using the same
// container — only at this item's own claim.
function getOrFetchContainer(
  job: DownloadJobState,
  containerUrl: string,
  jobSignal: AbortSignal,
  stagingDir: string,
  onProgress: (bytesDownloaded: number, totalBytes: number) => void,
): { promise: Promise<string>; release: () => void } {
  let entry = job.containerCache.get(containerUrl);
  if (!entry) {
    const controller = new AbortController();
    if (jobSignal.aborted) controller.abort();
    else jobSignal.addEventListener('abort', () => controller.abort(), { once: true });

    const containerPath = join(stagingDir, `${randomUUID()}-container`);
    const listeners = new Set([onProgress]);
    const promise = downloadFile({
      url: containerUrl,
      tempPath: containerPath,
      signal: controller.signal,
      onProgress: (bytesDownloaded, totalBytes) => {
        for (const listener of listeners) listener(bytesDownloaded, totalBytes);
      },
    }).then((result) => {
      if (result !== 'done') throw new Error(`container fetch failed: ${result}`);
      return containerPath;
    });
    entry = { promise, listeners, controller, refCount: 0 };
    job.containerCache.set(containerUrl, entry);
  } else {
    entry.listeners.add(onProgress);
  }

  const activeEntry = entry;
  activeEntry.refCount++;
  let released = false;
  return {
    promise: activeEntry.promise,
    release: () => {
      if (released) return;
      released = true;
      activeEntry.listeners.delete(onProgress);
      activeEntry.refCount--;
      if (activeEntry.refCount <= 0) activeEntry.controller.abort();
    },
  };
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
