import { describe, it, expect } from 'vitest';
import { fullyDownloadedGameIds } from '../completed-games.js';
import type { GameScopedItem } from '../completed-games.js';

function item(gameId: string, status: GameScopedItem['status']): GameScopedItem {
  return { gameId, status };
}

describe('fullyDownloadedGameIds', () => {
  it('returns nothing for an empty job', () => {
    expect(fullyDownloadedGameIds([])).toEqual([]);
  });

  it('reports a single-ROM game that succeeded', () => {
    expect(fullyDownloadedGameIds([item('a', 'done')])).toEqual(['a']);
  });

  it('leaves out a failed game', () => {
    expect(fullyDownloadedGameIds([item('a', 'failed')])).toEqual([]);
  });

  it('leaves out games still queued or in flight', () => {
    expect(fullyDownloadedGameIds([item('a', 'queued'), item('b', 'downloading')])).toEqual([]);
  });

  it('reports a multi-disc game only when every disc is done', () => {
    expect(fullyDownloadedGameIds([item('a', 'done'), item('a', 'done')])).toEqual(['a']);
  });

  it('leaves out a multi-disc game with one failed disc', () => {
    expect(fullyDownloadedGameIds([item('a', 'done'), item('a', 'failed')])).toEqual([]);
  });

  it('leaves out a multi-disc game whose later disc has not started', () => {
    expect(fullyDownloadedGameIds([item('a', 'done'), item('a', 'queued')])).toEqual([]);
  });

  it('separates successes from failures in a mixed job', () => {
    const items = [
      item('a', 'done'),
      item('b', 'failed'),
      item('c', 'done'),
      item('c', 'done'),
      item('d', 'done'),
      item('d', 'failed'),
    ];
    expect(fullyDownloadedGameIds(items).sort()).toEqual(['a', 'c']);
  });
});
