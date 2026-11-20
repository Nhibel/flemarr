import { describe, expect, it } from 'vitest';
import type { ResolvedSource } from '@shared/archive.js';
import type { ResolveResponse } from '@/lib/api.js';
import { buildDownloadItems } from '../build-items.js';

function source(
  over: Partial<ResolvedSource> & Pick<ResolvedSource, 'identifier'>,
): ResolvedSource {
  return {
    downloadUrl: `https://archive.org/download/${over.identifier}/rom.bin`,
    container: 'direct',
    extractFromZip: false,
    verified: true,
    ...over,
  };
}

function resolveResult(sources: ResolvedSource[], romNames = ['Game.bin']): ResolveResponse {
  return {
    results: [
      {
        gameId: 'g1',
        gameName: 'Game',
        roms: romNames.map((romName) => ({ romName, expectedCrc: 'aabbccdd', sources })),
      },
    ],
  };
}

describe('buildDownloadItems', () => {
  it('queues one item per ROM, so every disc of a multi-disc game', () => {
    const items = buildDownloadItems(
      resolveResult([source({ identifier: 'a' })], ['Disc 1.bin', 'Disc 2.bin']),
    );
    expect(items.map((i) => i.romName)).toEqual(['Disc 1.bin', 'Disc 2.bin']);
  });

  it('skips ROMs no source has', () => {
    expect(buildDownloadItems(resolveResult([]))).toEqual([]);
  });

  it('puts the picked source first, then the others of the same container kind', () => {
    const result = resolveResult([
      source({ identifier: 'a' }),
      source({ identifier: 'b' }),
      source({ identifier: 'c', container: 'zip-view' }),
    ]);
    const [item] = buildDownloadItems(result, new Map([['g1/Game.bin', 1]]));
    expect(item?.sources.map((s) => s.url)).toEqual([
      'https://archive.org/download/b/rom.bin',
      'https://archive.org/download/a/rom.bin',
    ]);
  });

  it('follows the chosen source with its own fallback before any other source', () => {
    const withFallback = source({
      identifier: 'a',
      container: 'archive-container',
      innerPath: 'Game.bin',
      archiveFormat: '7z',
      fallback: {
        downloadUrl: 'https://archive.org/view/a/Game.bin',
        container: 'zip-view',
        extractFromZip: true,
      },
    });
    const [item] = buildDownloadItems(
      resolveResult([withFallback, source({ identifier: 'b', container: 'archive-container' })]),
    );
    expect(item?.sources).toEqual([
      {
        url: 'https://archive.org/download/a/rom.bin',
        extractFromZip: false,
        innerPath: 'Game.bin',
        archiveFormat: '7z',
      },
      { url: 'https://archive.org/view/a/Game.bin', extractFromZip: true },
      {
        url: 'https://archive.org/download/b/rom.bin',
        extractFromZip: false,
        innerPath: undefined,
        archiveFormat: undefined,
      },
    ]);
  });

  it('falls back to the first source when the picked index no longer exists', () => {
    const [item] = buildDownloadItems(
      resolveResult([source({ identifier: 'a' })]),
      new Map([['g1/Game.bin', 5]]),
    );
    expect(item?.sources[0]?.url).toBe('https://archive.org/download/a/rom.bin');
  });
});
