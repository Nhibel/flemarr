import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSearchQuery,
  sampleRoms,
  scoreIndex,
  suggestSources,
} from '../services/archive-org/suggest.js';
import type { DatFile } from '@shared/dat.js';
import type { ArchiveFile } from '@shared/archive.js';

vi.mock('../services/archive-org/search.js', () => ({
  searchArchive: vi.fn(),
}));
vi.mock('../services/archive-org/metadata.js', () => ({
  getIndex: vi.fn(),
}));

import { searchArchive } from '../services/archive-org/search.js';
import { getIndex } from '../services/archive-org/metadata.js';

function makeDat(gameCount: number): DatFile {
  return {
    source: 'no-intro',
    system: 'Nintendo - Super Nintendo Entertainment System',
    games: Array.from({ length: gameCount }, (_, i) => ({
      id: `g${i}`,
      name: `Game ${i} (USA)`,
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [
        {
          name: `Game ${i} (USA).sfc`,
          size: 1024,
          crc: (i + 1).toString(16).padStart(8, '0'),
          status: 'good' as const,
        },
      ],
    })),
  };
}

function file(name: string, crc32?: string): ArchiveFile {
  return { name, size: 1024, crc32 };
}

describe('buildSearchQuery', () => {
  it('combines the authority and the short system name', () => {
    expect(buildSearchQuery('Nintendo - Super Nintendo Entertainment System', 'no-intro')).toBe(
      'No-Intro Super Nintendo Entertainment System',
    );
    expect(buildSearchQuery('Sony - PlayStation', 'redump')).toBe('Redump PlayStation');
  });

  it('keeps the name as-is when there is no vendor prefix', () => {
    expect(buildSearchQuery('Neo Geo', 'no-intro')).toBe('No-Intro Neo Geo');
  });
});

describe('sampleRoms', () => {
  it('returns everything when the DAT is smaller than the sample size', () => {
    expect(sampleRoms(makeDat(10), 50)).toHaveLength(10);
  });

  it('strides evenly across a large DAT', () => {
    const sample = sampleRoms(makeDat(1000), 50);
    expect(sample).toHaveLength(50);
    // First and a late entry should span the whole set, not just the head
    expect(sample[0]?.name).toBe('Game 0 (USA).sfc');
    expect(sample.at(-1)?.name).toBe('Game 980 (USA).sfc');
  });
});

describe('scoreIndex', () => {
  const SAMPLE = [
    { name: 'Game A (USA).sfc', crc: 'aaaaaaaa' },
    { name: 'Game B (USA).sfc', crc: 'bbbbbbbb' },
    { name: 'Game C (USA).sfc', crc: 'cccccccc' },
    { name: 'Game D (USA).sfc', crc: 'dddddddd' },
  ];

  it('matches by CRC32 regardless of filename', () => {
    const files = [file('whatever.bin', 'AAAAAAAA')];
    expect(scoreIndex(files, SAMPLE)).toBe(0.25);
  });

  it('matches by exact filename', () => {
    const files = [file('Game B (USA).sfc')];
    expect(scoreIndex(files, SAMPLE)).toBe(0.25);
  });

  it('matches a per-game ZIP named after the ROM', () => {
    const files = [file('Game C (USA).zip')];
    expect(scoreIndex(files, SAMPLE)).toBe(0.25);
  });

  it('combines match types and caps at 1', () => {
    const files = [
      file('x.bin', 'aaaaaaaa'),
      file('Game B (USA).sfc'),
      file('Game C (USA).zip'),
      file('Game D (USA).sfc', 'dddddddd'),
    ];
    expect(scoreIndex(files, SAMPLE)).toBe(1);
  });

  it('returns 0 for an empty sample or no matches', () => {
    expect(scoreIndex([file('a.sfc')], [])).toBe(0);
    expect(scoreIndex([file('unrelated.iso')], SAMPLE)).toBe(0);
  });
});

describe('suggestSources', () => {
  beforeEach(() => {
    vi.mocked(searchArchive).mockReset();
    vi.mocked(getIndex).mockReset();
  });

  it('ranks candidates by coverage and skips unreachable ones', async () => {
    const dat = makeDat(4);
    vi.mocked(searchArchive).mockResolvedValue([
      { identifier: 'bad-collection', title: 'Bad', description: '' },
      { identifier: 'good-collection', title: 'Good', description: '' },
      { identifier: 'dead-collection', title: 'Dead', description: '' },
    ]);
    vi.mocked(getIndex).mockImplementation((id: string) => {
      if (id === 'dead-collection') return Promise.reject(new Error('404'));
      if (id === 'good-collection') {
        return Promise.resolve(dat.games.map((g) => file(g.roms[0]!.name, g.roms[0]!.crc)));
      }
      return Promise.resolve([file('unrelated.iso')]);
    });

    const suggestions = await suggestSources(dat);
    expect(suggestions.map((s) => s.identifier)).toEqual(['good-collection', 'bad-collection']);
    expect(suggestions[0]?.coverage).toBe(1);
    expect(suggestions[0]?.layout).toBe('direct');
    expect(suggestions[1]?.coverage).toBe(0);
  });
});
