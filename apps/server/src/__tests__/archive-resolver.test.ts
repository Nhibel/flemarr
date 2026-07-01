import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveGames, clearResolverCache } from '../services/archive-org/resolver.js';
import { addSource, removeSource } from '../services/archive-org/sources.js';
import type { DatFile } from '@shared/dat.js';
import type { ArchiveFile } from '@shared/archive.js';

vi.mock('../services/archive-org/metadata.js', () => ({
  getIndex: vi.fn(),
  resolveDownloadUrl: vi.fn((id: string, file: string, zip?: string) =>
    zip
      ? `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(zip)}/${encodeURIComponent(file)}`
      : `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(file)}`,
  ),
  clearCache: vi.fn(),
}));

import { getIndex } from '../services/archive-org/metadata.js';

const FIXTURE_DAT: DatFile = {
  source: 'no-intro',
  system: 'Nintendo - Super Nintendo Entertainment System',
  games: [
    {
      id: 'smw',
      name: 'Super Mario World (USA)',
      region: ['USA'],
      languages: ['En'],
      roms: [
        { name: 'Super Mario World (USA).sfc', size: 524288, crc: 'b19ed489', status: 'good' },
      ],
    },
    {
      id: 'yoshi',
      name: "Yoshi's Island (USA)",
      region: ['USA'],
      languages: ['En'],
      roms: [{ name: "Yoshi's Island (USA).sfc", size: 1048576, crc: 'deadbeef', status: 'good' }],
    },
  ],
};

const DIRECT_FILES: ArchiveFile[] = [
  { name: 'Super Mario World (USA).sfc', size: 524288, crc32: 'b19ed489', format: 'Super NES ROM' },
  { name: 'Other Game (USA).sfc', size: 131072, crc32: '11223344', format: 'Super NES ROM' },
];

const ZIP_FILES: ArchiveFile[] = [{ name: 'No-Intro SNES.zip', size: 999999999, format: 'ZIP' }];

beforeEach(() => {
  clearResolverCache();
  vi.mocked(getIndex).mockReset();
  // Clean up any sources added in previous tests
  removeSource('direct-snes');
  removeSource('zip-snes');
});

describe('resolveGames — direct layout', () => {
  it('finds a game by CRC match', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue(DIRECT_FILES);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results).toHaveLength(1);
    expect(results[0]?.sources).toHaveLength(1);
    expect(results[0]?.sources[0]?.container).toBe('direct');
    expect(results[0]?.sources[0]?.downloadUrl).toContain('Super%20Mario%20World');
  });

  it('returns empty sources for a game not in the collection', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue(DIRECT_FILES);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['yoshi']);
    expect(results[0]?.sources).toHaveLength(0);
  });

  it('matches by filename when CRC is absent from archive metadata', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    const filesNoCrc: ArchiveFile[] = [{ name: 'Super Mario World (USA).sfc', size: 524288 }];
    vi.mocked(getIndex).mockResolvedValue(filesNoCrc);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.sources).toHaveLength(1);
  });
});

describe('resolveGames — zip-collection layout', () => {
  it('generates zip-entry URLs for each ZIP in the collection', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'zip-snes',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue(ZIP_FILES);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.sources).toHaveLength(1);
    expect(results[0]?.sources[0]?.container).toBe('zip-entry');
    expect(results[0]?.sources[0]?.downloadUrl).toContain('No-Intro%20SNES.zip');
  });
});

describe('resolveGames — cache', () => {
  it('does not refetch when result is cached', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue(DIRECT_FILES);

    await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(vi.mocked(getIndex)).toHaveBeenCalledTimes(1);
  });
});

describe('resolveGames — error handling', () => {
  it('skips unreachable sources and returns empty sources, no throw', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    vi.mocked(getIndex).mockRejectedValue(new Error('network error'));

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.sources).toHaveLength(0);
  });

  it('returns empty result for unknown gameId', async () => {
    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['nonexistent']);
    expect(results[0]?.sources).toHaveLength(0);
    expect(results[0]?.romName).toBe('');
  });
});
