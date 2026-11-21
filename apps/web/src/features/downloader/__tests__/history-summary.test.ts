import { describe, it, expect } from 'vitest';
import type { DownloadHistoryEntry } from '@shared/download.js';
import { summarizeHistory } from '../history-summary.js';

function attempt(
  gameId: string,
  romName: string,
  status: 'done' | 'failed',
  completedAt: number,
): DownloadHistoryEntry {
  return {
    gameId,
    romName,
    destination: '/roms',
    status,
    errorMessage: status === 'failed' ? `${romName} failed` : null,
    completedAt,
  };
}

describe('summarizeHistory', () => {
  // Entries come newest first, as the server sends them.
  it('reads a game retried successfully as done', () => {
    const games = summarizeHistory([
      attempt('g1', 'a.bin', 'done', 2),
      attempt('g1', 'a.bin', 'failed', 1),
    ]);
    expect(games).toEqual([
      { gameId: 'g1', status: 'done', lastAt: 2, destination: '/roms', errorMessage: null },
    ]);
  });

  it('reads a game as failed while one of its roms is', () => {
    const games = summarizeHistory([
      attempt('g1', 'a.cue', 'done', 3),
      attempt('g1', 'a.bin', 'failed', 2),
    ]);
    expect(games[0]).toMatchObject({ status: 'failed', lastAt: 3, errorMessage: 'a.bin failed' });
  });

  it('lists the newest first, whatever the outcome', () => {
    const games = summarizeHistory([
      attempt('new', 'n.bin', 'done', 9),
      attempt('old', 'o.bin', 'done', 1),
      attempt('bad', 'b.bin', 'failed', 5),
    ]);
    expect(games.map((game) => game.gameId)).toEqual(['new', 'bad', 'old']);
  });

  it('has nothing to show without attempts', () => {
    expect(summarizeHistory([])).toEqual([]);
  });
});
