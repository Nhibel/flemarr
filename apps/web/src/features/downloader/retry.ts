import type { DownloadItem, DownloadRequest } from '@shared/download.js';
import type { QueuedDownload } from './job-state.js';

/**
 * 'same' retries the sources the game already had — the usual case, since
 * most failures are a collection being briefly unreachable. 'elsewhere'
 * re-resolves against every configured source, for when that collection is
 * actually gone.
 */
export type RetryMode = 'same' | 'elsewhere';

/** The items of one game from a past job, sources included, for a 'same' retry. */
export function itemsOfGame(queued: QueuedDownload, gameId: string): DownloadItem[] {
  return queued.items.filter((item) => item.gameId === gameId);
}

/**
 * A retry is a new download to the same place as the job it comes from:
 * same DAT, same target, same folder when the target is the server.
 */
export function buildRetryRequest(queued: QueuedDownload, items: DownloadItem[]): DownloadRequest {
  if (queued.target === 'server') {
    return {
      datId: queued.datId,
      items,
      target: 'server',
      destinationDir: queued.destinationDir,
    };
  }
  return { datId: queued.datId, items, target: 'browser' };
}
