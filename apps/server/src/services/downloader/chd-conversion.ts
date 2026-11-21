import { randomUUID } from 'node:crypto';
import { rename, rm, mkdir, copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { getDat } from '@/services/dat/store.js';
import { logger } from '@/lib/logger.js';
import type { Rom } from '@shared/dat.js';
import { convertGameToChd } from './chd.js';
import { BROWSER_STAGING_DIR, browserFileUrl } from './job-store.js';
import type { DownloadItemState, DownloadJobState } from './job-store.js';

// Only games with a .cue among the DAT's own roms (disc systems) are
// eligible for CHD conversion — everything else (cartridge systems) returns
// undefined, a silent no-op rather than an error, for both target types.
export function getConvertibleRoms(datId: string, gameId: string): Rom[] | undefined {
  const dat = getDat(datId);
  const game = dat?.games.find((g) => g.id === gameId);
  if (!game) return undefined;
  const roms = game.roms.filter((r) => r.crc !== undefined);
  if (!roms.some((r) => r.name.toLowerCase().endsWith('.cue'))) return undefined;
  return roms;
}

// Emits the ordinary browser-save prompt individually for each given item —
// the fallback whenever a game that was eligible for CHD conversion never
// actually gets converted (chdman failed, or runGame skipped conversion
// outright because a sibling rom failed/cancelled first).
export function emitIndividualFallback(
  job: DownloadJobState,
  jobId: string,
  items: Pick<DownloadItemState, 'gameId' | 'romName'>[],
): void {
  for (const item of items) {
    job.events.push({
      type: 'file-ready',
      gameId: item.gameId,
      romName: item.romName,
      downloadUrl: browserFileUrl(jobId, item.gameId, item.romName),
    });
  }
}

// Called by runGame (in runQueue) once every rom of `gameId` has reached
// 'done' — `roms` is already known-eligible (see getConvertibleRoms).
export async function maybeConvertGame(
  job: DownloadJobState,
  gameId: string,
  destinationDir: string,
  roms: Rom[],
): Promise<void> {
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
export async function maybeConvertGameForBrowser(
  job: DownloadJobState,
  jobId: string,
  gameId: string,
  roms: Rom[],
): Promise<void> {
  const gameItems = job.items.filter((i) => i.gameId === gameId && i.status === 'done');

  job.events.push({ type: 'game-converting', gameId });

  const scratchDir = join(tmpdir(), `flemarr-chd-browser-${randomUUID()}`);
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
      emitIndividualFallback(job, jobId, gameItems);
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
      downloadUrl: browserFileUrl(jobId, gameId, filename),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn(
      { gameId, scratchDir, reason },
      'browser-target CHD conversion threw, falling back',
    );
    job.events.push({ type: 'game-convert-failed', gameId, reason });
    emitIndividualFallback(job, jobId, gameItems);
  } finally {
    // On success the .chd was already moved out above; this only ever
    // removes the (now-empty, or never-fully-populated on failure) scratch
    // dir itself — the originals it held were copies, never the real
    // tempPaths, so there's nothing here that emitIndividualFallback
    // still needs.
    await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
