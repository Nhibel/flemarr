import { describe, expect, it } from 'vitest';
import type { ResolvedGame, ResolvedSource } from '@shared/archive.js';
import type { ArchiveSource } from '@/lib/api.js';
import { sourceKeyOf, summarizeResolve } from '../resolve-summary.js';

const SOURCE: ResolvedSource = {
  identifier: 'a',
  downloadUrl: 'https://archive.org/download/a/rom.bin',
  container: 'direct',
  extractFromZip: false,
  verified: true,
};

/** A game whose ROMs are found (true) or not (false), in order. */
function game(gameId: string, romsFound: boolean[]): ResolvedGame {
  return {
    gameId,
    gameName: gameId,
    roms: romsFound.map((found, index) => ({
      romName: `${gameId}-${index}.bin`,
      expectedCrc: 'aabbccdd',
      sources: found ? [SOURCE] : [],
    })),
  };
}

describe('summarizeResolve', () => {
  it('sorts games into complete, partial and not found', () => {
    const summary = summarizeResolve({
      results: [
        game('complete', [true, true]),
        game('partial', [true, false]),
        game('missing', [false]),
      ],
    });
    expect(summary).toMatchObject({ complete: 1, partial: 1, notFound: 1 });
  });

  it('counts one downloadable file per found ROM, across games', () => {
    const summary = summarizeResolve({
      results: [game('a', [true, true]), game('b', [true, false])],
    });
    expect(summary.downloadableCount).toBe(3);
  });

  it('counts a game with no ROM as not found, never complete', () => {
    expect(summarizeResolve({ results: [game('empty', [])] })).toMatchObject({
      complete: 0,
      notFound: 1,
    });
  });

  it('is all zeros for an empty result', () => {
    expect(summarizeResolve({ results: [] })).toEqual({
      complete: 0,
      partial: 0,
      notFound: 0,
      downloadableCount: 0,
    });
  });
});

describe('sourceKeyOf', () => {
  const zip: ArchiveSource = { identifier: 'zip', layout: 'zip-collection', note: '' };
  const direct: ArchiveSource = { identifier: 'direct', layout: 'direct', note: '' };

  it('ignores the order sources were added in', () => {
    expect(sourceKeyOf([zip, direct])).toBe(sourceKeyOf([direct, zip]));
  });

  it('changes when a layout is corrected', () => {
    expect(sourceKeyOf([zip])).not.toBe(sourceKeyOf([{ ...zip, layout: 'direct' }]));
  });

  it('is empty without sources', () => {
    expect(sourceKeyOf([])).toBe('');
  });
});
