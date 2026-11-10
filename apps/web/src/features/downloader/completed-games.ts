export type DownloadItemStatus = 'queued' | 'downloading' | 'done' | 'failed';

export interface GameScopedItem {
  gameId: string;
  status: DownloadItemStatus;
}

/**
 * The gameIds whose *every* item in the job succeeded.
 *
 * A multi-disc game queues one item per ROM under the same gameId: it only
 * counts as downloaded once all of them are 'done'. A game with a failed,
 * still-queued or in-flight item is left out, so the caller can keep it
 * flagged for a retry.
 */
export function fullyDownloadedGameIds(items: readonly GameScopedItem[]): string[] {
  const complete = new Map<string, boolean>();
  for (const item of items) {
    const done = item.status === 'done';
    complete.set(item.gameId, (complete.get(item.gameId) ?? true) && done);
  }
  return [...complete].filter(([, done]) => done).map(([gameId]) => gameId);
}
