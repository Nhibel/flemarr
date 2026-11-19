import type { DownloadEvent } from '@/lib/api.js';
import type { DownloadItem } from '@shared/download.js';
import type { ItemStatus } from './game-status.js';

export interface QueuedDownload {
  jobId: string;
  datId: string;
  /**
   * The full items, sources included — which is what ResolvePanel already
   * passed; only this type was narrower. Keeping them is what lets a failed
   * game be retried against the same source without resolving again.
   */
  items: DownloadItem[];
  target: 'server' | 'browser';
  destinationDir?: string;
}

/**
 * -1 means "unknown total" (archive.org's zip-view extraction streams
 * chunked, with no Content-Length — every restricted zip-collection source
 * hits this, not just an occasional one) — rendered as bytes downloaded and
 * an indeterminate bar instead of a percentage that would otherwise read as
 * permanently stuck at 0.
 */
export const UNKNOWN = -1;

export interface ItemState {
  gameId: string;
  romName: string;
  status: ItemStatus;
  /** 0-100, or UNKNOWN. */
  progress: number;
  bytesDownloaded: number;
  /** UNKNOWN when the source sends no length, 0 before the first progress event. */
  totalBytes: number;
  failReason?: string;
}

export interface GameConversionState {
  status: 'converting' | 'converted' | 'failed';
  reason?: string;
}

export type JobStatus = 'running' | 'done' | 'cancelled' | 'error';

export interface JobState {
  jobId: string;
  target: 'server' | 'browser';
  destinationDir?: string;
  status: JobStatus;
  items: ItemState[];
  /**
   * Keyed by gameId, not romName — CHD conversion is a whole-game step
   * (every rom of a disc folds into one .chd), not a per-file one.
   */
  gameConversions: Map<string, GameConversionState>;
}

/** A just-queued job: running, every item waiting, nothing converted. */
export function initJobState(queued: QueuedDownload): JobState {
  return {
    jobId: queued.jobId,
    target: queued.target,
    destinationDir: queued.destinationDir,
    status: 'running',
    items: queued.items.map((item) => ({
      gameId: item.gameId,
      romName: item.romName,
      status: 'queued',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
    })),
    gameConversions: new Map(),
  };
}

/** True once the server will send nothing more for this job. */
export function isFinalEvent(event: DownloadEvent): boolean {
  return event.type === 'complete' || event.type === 'cancelled' || event.type === 'error';
}

/** The job as it stands after one event from its SSE stream. Never mutates `job`. */
export function applyDownloadEvent(job: JobState, event: DownloadEvent): JobState {
  switch (event.type) {
    case 'progress': {
      const hasKnownTotal = event.totalBytes > 0;
      return updateItem(job, event.gameId, event.romName, (item) => ({
        ...item,
        status: 'downloading',
        progress: hasKnownTotal
          ? Math.round((event.bytesDownloaded / event.totalBytes) * 100)
          : UNKNOWN,
        bytesDownloaded: event.bytesDownloaded,
        // Kept so the job can say what is left to transfer. summarizeJob
        // withholds the estimate on an unknown total instead of inventing one.
        totalBytes: hasKnownTotal ? event.totalBytes : UNKNOWN,
      }));
    }
    case 'file-extracting':
      return updateItem(job, event.gameId, event.romName, (item) => ({
        ...item,
        status: 'extracting',
      }));
    case 'file-done':
    case 'file-ready':
      return updateItem(job, event.gameId, event.romName, (item) => ({
        ...item,
        status: 'done',
        progress: 100,
      }));
    case 'file-failed':
      return updateItem(job, event.gameId, event.romName, (item) => ({
        ...item,
        status: 'failed',
        failReason: event.reason,
      }));
    case 'file-cancelled':
      // Dropped outright, not marked — a cancelled item isn't a failure to
      // show and investigate, it's "never mind, don't want this one."
      return {
        ...job,
        items: job.items.filter((item) => !isItem(item, event.gameId, event.romName)),
      };
    case 'game-converting':
      return setConversion(job, event.gameId, { status: 'converting' });
    case 'game-converted':
      return setConversion(job, event.gameId, { status: 'converted' });
    case 'game-convert-failed':
      return setConversion(job, event.gameId, { status: 'failed', reason: event.reason });
    case 'complete':
      return { ...job, status: 'done' };
    case 'cancelled':
      return { ...job, status: 'cancelled' };
    case 'error':
      return { ...job, status: 'error' };
  }
}

/** Items are identified by gameId + romName: a multi-disc game queues one item per disc. */
function isItem(item: ItemState, gameId: string, romName: string): boolean {
  return item.gameId === gameId && item.romName === romName;
}

function updateItem(
  job: JobState,
  gameId: string,
  romName: string,
  update: (item: ItemState) => ItemState,
): JobState {
  const items = job.items.map((item) => (isItem(item, gameId, romName) ? update(item) : item));
  return { ...job, items };
}

function setConversion(job: JobState, gameId: string, conversion: GameConversionState): JobState {
  const gameConversions = new Map(job.gameConversions);
  gameConversions.set(gameId, conversion);
  return { ...job, gameConversions };
}
