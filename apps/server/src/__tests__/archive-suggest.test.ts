import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSearchQueries,
  normalizeSystemName,
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
  getItemInfo: vi.fn(),
  resolveDownloadUrl: vi.fn((id: string, file: string, zip?: string) =>
    zip
      ? `https://archive.org/download/${id}/${zip}/${file}`
      : `https://archive.org/download/${id}/${file}`,
  ),
}));
vi.mock('../services/archive-org/url-check.js', () => ({
  urlExists: vi.fn(),
}));
vi.mock('../services/archive-org/zip-listing.js', () => ({
  getZipListing: vi.fn(),
}));

import { searchArchive } from '../services/archive-org/search.js';
import { getIndex, getItemInfo } from '../services/archive-org/metadata.js';
import { urlExists } from '../services/archive-org/url-check.js';
import { getZipListing } from '../services/archive-org/zip-listing.js';

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

describe('normalizeSystemName', () => {
  it('strips the vendor prefix', () => {
    expect(normalizeSystemName('Nintendo - Super Nintendo Entertainment System')).toBe(
      'Super Nintendo Entertainment System',
    );
  });

  it('strips trailing parenthesized tags like (Retool)', () => {
    expect(normalizeSystemName('Nintendo - Super Nintendo Entertainment System (Retool)')).toBe(
      'Super Nintendo Entertainment System',
    );
    expect(normalizeSystemName('Sega - Mega CD & Sega CD (Retool)')).toBe('Mega CD & Sega CD');
  });

  it('keeps intermediate dashes in the system part', () => {
    expect(normalizeSystemName('Sega - Mega Drive - Genesis (Retool)')).toBe(
      'Mega Drive - Genesis',
    );
  });

  it('keeps the name as-is when there is no vendor prefix', () => {
    expect(normalizeSystemName('Neo Geo')).toBe('Neo Geo');
  });
});

describe('buildSearchQueries', () => {
  it('generates authority and alias variants without the (Retool) tag', () => {
    const queries = buildSearchQueries(
      'Nintendo - Super Nintendo Entertainment System (Retool)',
      'no-intro',
    );
    expect(queries).toContain('No-Intro Super Nintendo Entertainment System');
    expect(queries).toContain('No-Intro SNES');
    expect(queries.every((q) => !q.includes('(Retool)'))).toBe(true);
    expect(queries.length).toBeLessThanOrEqual(4);
  });

  it('uses Redump for disc-based DATs', () => {
    const queries = buildSearchQueries('Sony - PlayStation', 'redump');
    expect(queries[0]).toBe('Redump PlayStation');
    expect(queries).toContain('Redump PSX');
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

  it('matches files nested in subdirectories by basename', () => {
    const files = [file('SNES/roms/Game A (USA).sfc'), file('sub/Game B (USA).zip')];
    expect(scoreIndex(files, SAMPLE)).toBe(0.5);
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
    // Default: public item whose file list comes from the getIndex mock
    vi.mocked(getItemInfo)
      .mockReset()
      .mockImplementation(async (id: string) => ({
        files: await getIndex(id),
        restricted: false,
        server: '',
        dir: '',
      }));
    vi.mocked(urlExists).mockReset().mockResolvedValue(false);
    vi.mocked(getZipListing).mockReset().mockResolvedValue([]);
  });

  it('keeps covered candidates, drops zero-coverage and unreachable ones', async () => {
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
    expect(suggestions.map((s) => s.identifier)).toEqual(['good-collection']);
    expect(suggestions[0]?.coverage).toBe(1);
    expect(suggestions[0]?.layout).toBe('direct');
  });

  it('merges candidates from several query variants without duplicates', async () => {
    const dat = makeDat(4);
    const goodFiles = dat.games.map((g) => file(g.roms[0]!.name, g.roms[0]!.crc));
    vi.mocked(searchArchive)
      .mockResolvedValueOnce([{ identifier: 'from-query-1', title: 'A', description: '' }])
      .mockResolvedValue([
        { identifier: 'from-query-1', title: 'A', description: '' },
        { identifier: 'from-query-2', title: 'B', description: '' },
      ]);
    vi.mocked(getIndex).mockImplementation((id: string) =>
      Promise.resolve(id.startsWith('from-query') ? goodFiles : [file('unrelated.iso')]),
    );

    const suggestions = await suggestSources(dat);
    expect(vi.mocked(searchArchive).mock.calls.length).toBeGreaterThan(1);
    expect(suggestions.map((s) => s.identifier).sort()).toEqual(['from-query-1', 'from-query-2']);
    // deduped: from-query-1 scored once despite appearing in every query
    const fromQueryCalls = vi
      .mocked(getIndex)
      .mock.calls.filter((c) => String(c[0]).startsWith('from-query'));
    expect(fromQueryCalls).toHaveLength(2);
  });

  it('scores big items first when there are more candidates than slots', async () => {
    const dat = makeDat(4);
    const many = Array.from({ length: 15 }, (_, i) => ({
      identifier: `small-${i}`,
      title: `Small ${i}`,
      description: '',
      itemSize: 1000,
    }));
    vi.mocked(searchArchive).mockResolvedValue([
      ...many,
      { identifier: 'the-fullset', title: 'Fullset', description: '', itemSize: 5_000_000_000 },
    ]);
    vi.mocked(getIndex).mockImplementation((id: string) =>
      Promise.resolve(
        id === 'the-fullset'
          ? dat.games.map((g) => file(g.roms[0]!.name, g.roms[0]!.crc))
          : [file('unrelated.iso')],
      ),
    );

    const suggestions = await suggestSources(dat);
    expect(suggestions.map((s) => s.identifier)).toEqual(['the-fullset']);
    // the biggest candidates were fetched first (chunks of 3, stop at 10 scored)
    expect(vi.mocked(getIndex).mock.calls.length).toBeLessThanOrEqual(12);
    expect(vi.mocked(getIndex)).toHaveBeenCalledWith('the-fullset');
  });

  it('skips access-restricted items and scores the next candidates', async () => {
    const dat = makeDat(4);
    const goodFiles = dat.games.map((g) => file(g.roms[0]!.name, g.roms[0]!.crc));
    vi.mocked(searchArchive).mockResolvedValue([
      { identifier: 'restricted-fullset', title: 'R', description: '', itemSize: 999_999_999 },
      { identifier: 'public-set', title: 'P', description: '', itemSize: 1000 },
    ]);
    vi.mocked(getItemInfo).mockImplementation((id: string) =>
      Promise.resolve({
        files: id === 'public-set' ? goodFiles : [file('unrelated.iso')],
        restricted: id === 'restricted-fullset',
        server: '',
        dir: '',
      }),
    );

    const suggestions = await suggestSources(dat);
    expect(suggestions.map((s) => s.identifier)).toEqual(['public-set']);
  });

  it('scores restricted items when archive.org credentials are configured', async () => {
    const { updateSettings } = await import('../services/settings/index.js');
    updateSettings({ archiveOrgAccessKey: 'ak', archiveOrgSecretKey: 'sk' });
    try {
      const dat = makeDat(4);
      const goodFiles = dat.games.map((g) => file(g.roms[0]!.name, g.roms[0]!.crc));
      vi.mocked(searchArchive).mockResolvedValue([
        { identifier: 'restricted-fullset', title: 'R', description: '', itemSize: 999_999_999 },
      ]);
      vi.mocked(getItemInfo).mockImplementation((id: string) =>
        Promise.resolve({
          files: id === 'restricted-fullset' ? goodFiles : [file('unrelated.iso')],
          restricted: true,
          server: '',
          dir: '',
        }),
      );

      const suggestions = await suggestSources(dat);
      expect(suggestions.map((s) => s.identifier)).toEqual(['restricted-fullset']);
      expect(suggestions[0]?.coverage).toBe(1);
    } finally {
      updateSettings({ archiveOrgAccessKey: '', archiveOrgSecretKey: '' });
    }
  });

  it('throws when every search query fails', async () => {
    vi.mocked(searchArchive).mockRejectedValue(new Error('archive.org search returned 503'));
    await expect(suggestSources(makeDat(2))).rejects.toThrow('503');
  });

  it('injects known multi-system collections even when search misses them', async () => {
    const dat = makeDat(4);
    vi.mocked(searchArchive).mockResolvedValue([]); // search finds nothing at all
    vi.mocked(getItemInfo).mockImplementation((id: string) =>
      Promise.resolve({
        files:
          id === 'ni-roms'
            ? [file('roms/Nintendo - Super Nintendo Entertainment System.zip')]
            : [file('unrelated.iso')],
        restricted: false,
        server: id === 'ni-roms' ? 'ia800000.us.archive.org' : '',
        dir: id === 'ni-roms' ? '/17/items/ni-roms' : '',
      }),
    );
    // The system ZIP's inner listing re-zips every sample ROM as "<name>.zip"
    vi.mocked(getZipListing).mockResolvedValue(
      dat.games.map((g) => `${g.roms[0]!.name.replace(/\.\w+$/, '')}.zip`),
    );

    const suggestions = await suggestSources(dat);
    expect(suggestions.map((s) => s.identifier)).toEqual(['ni-roms']);
    expect(suggestions[0]?.coverage).toBe(1);
    expect(suggestions[0]?.layout).toBe('zip-collection');
  });

  it('scores one-zip-per-system collections against the ZIP inner listing', async () => {
    const dat = makeDat(8);
    vi.mocked(searchArchive).mockResolvedValue([
      { identifier: 'proper1g1r-like', title: '1G1R collection', description: '' },
    ]);
    // Index has nothing matching individual ROMs — just per-system ZIPs in a subdir
    vi.mocked(getItemInfo).mockImplementation((id: string) =>
      Promise.resolve({
        files:
          id === 'proper1g1r-like'
            ? [
                file('ROMs/Nintendo - Super Nintendo Entertainment System.zip'),
                file('ROMs/Sega - Mega Drive - Genesis.zip'),
              ]
            : [file('unrelated.iso')],
        restricted: false,
        server: 'ia800000.us.archive.org',
        dir: '/17/items/proper1g1r-like',
      }),
    );
    // The SNES system ZIP lists the raw ROMs
    vi.mocked(getZipListing).mockResolvedValue(dat.games.map((g) => g.roms[0]!.name));

    const suggestions = await suggestSources(dat);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.identifier).toBe('proper1g1r-like');
    expect(suggestions[0]?.coverage).toBe(1);
    expect(suggestions[0]?.layout).toBe('zip-collection');
    // Listed the system-matching ZIP, not an unrelated one
    expect(vi.mocked(getZipListing).mock.calls[0]?.[2]).toContain('Super Nintendo');
  });

  it('does not probe collections without a system-matching zip', async () => {
    const dat = makeDat(4);
    vi.mocked(searchArchive).mockResolvedValue([
      { identifier: 'unrelated', title: 'Unrelated', description: '' },
    ]);
    vi.mocked(getIndex).mockResolvedValue([file('Some Other Thing.zip')]);

    const suggestions = await suggestSources(dat);
    expect(suggestions).toHaveLength(0);
    expect(vi.mocked(getZipListing)).not.toHaveBeenCalled();
  });
});
