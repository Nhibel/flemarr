import type { DownloadHistoryEntry } from '@shared/download.js';

export interface GameHistory {
  gameId: string;
  /** Failed while any of its roms' latest attempt failed. */
  status: 'done' | 'failed';
  lastAt: number;
  destination: string;
  /** The latest failure's reason, when the game failed. */
  errorMessage: string | null;
}

/**
 * One line per game from the raw attempts: what counts is each rom's
 * latest attempt, so a game retried successfully reads as done. Failed
 * games first (what needs attention), then newest first.
 */
export function summarizeHistory(entries: DownloadHistoryEntry[]): GameHistory[] {
  // Entries arrive newest first: the first seen per rom is its latest.
  const latestPerRom = new Map<string, DownloadHistoryEntry>();
  for (const entry of entries) {
    const key = `${entry.gameId}/${entry.romName}`;
    if (!latestPerRom.has(key)) latestPerRom.set(key, entry);
  }

  const games = new Map<string, GameHistory>();
  for (const entry of latestPerRom.values()) {
    const game = games.get(entry.gameId);
    if (game === undefined) {
      games.set(entry.gameId, {
        gameId: entry.gameId,
        status: entry.status,
        lastAt: entry.completedAt,
        destination: entry.destination,
        errorMessage: entry.errorMessage,
      });
      continue;
    }
    game.lastAt = Math.max(game.lastAt, entry.completedAt);
    if (entry.status === 'failed') {
      game.status = 'failed';
      game.errorMessage ??= entry.errorMessage;
    }
  }

  return [...games.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'failed' ? -1 : 1;
    return b.lastAt - a.lastAt;
  });
}
