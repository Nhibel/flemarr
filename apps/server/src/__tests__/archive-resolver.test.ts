import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveGames, clearResolverCache } from '../services/archive-org/resolver.js';
import { addSource, removeSource } from '../services/archive-org/sources.js';
import type { DatFile } from '@shared/dat.js';
import type { ArchiveFile } from '@shared/archive.js';

vi.mock('../services/archive-org/metadata.js', () => ({
  getIndex: vi.fn(),
  getItemInfo: vi.fn(),
  resolveDownloadUrl: vi.fn((id: string, file: string, zip?: string) =>
    zip
      ? `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(zip)}/${encodeURIComponent(file)}`
      : `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(file)}`,
  ),
  resolveZipViewUrl: vi.fn(
    (server: string, dir: string, zip: string, inner: string) =>
      `https://${server}/view_archive.php?archive=${encodeURIComponent(`${dir}/${zip}`)}&file=${encodeURIComponent(inner)}`,
  ),
  clearCache: vi.fn(),
}));

vi.mock('../services/archive-org/url-check.js', () => ({
  urlExists: vi.fn(),
}));

vi.mock('../services/archive-org/zip-listing.js', () => ({
  getZipListing: vi.fn(),
}));

import { getIndex, getItemInfo } from '../services/archive-org/metadata.js';
import { urlExists } from '../services/archive-org/url-check.js';
import { getZipListing } from '../services/archive-org/zip-listing.js';

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
  vi.mocked(getZipListing).mockReset();
  // resolveOneGame now consumes getItemInfo — default to a public item whose
  // file list is whatever the getIndex mock was set to return.
  vi.mocked(getItemInfo)
    .mockReset()
    .mockImplementation(async (id: string) => ({
      files: await getIndex(id),
      restricted: false,
      server: '',
      dir: '',
    }));
  vi.mocked(urlExists).mockReset().mockResolvedValue(true);
  // Clean up any sources added in previous tests
  for (const id of ['direct-snes', 'zip-snes', 'ni-like']) {
    removeSource(id, 'Nintendo - Super Nintendo Entertainment System');
  }
  removeSource('sony_playstation_part1', 'Sony - PlayStation');
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
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[0]?.sources[0]?.container).toBe('direct');
    expect(results[0]?.roms[0]?.sources[0]?.verified).toBe(true);
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain('Super%20Mario%20World');
  });

  it('returns empty sources for a game not in the collection', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue(DIRECT_FILES);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['yoshi']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(0);
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
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    // Name-only match — a guess, never confirmed by a CRC32 equality (see
    // "Name-only matches" in docs/archive-org-strategy.md).
    expect(results[0]?.roms[0]?.sources[0]?.verified).toBe(false);
  });

  it('matches by filename ignoring extension (e.g. a Headerless NES DAT\'s ".unh" rom against a real ".nes" upload)', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    const headerlessDat: DatFile = {
      ...FIXTURE_DAT,
      games: [
        {
          ...FIXTURE_DAT.games[0]!,
          roms: [
            { name: 'Super Mario World (USA).unh', size: 524288, crc: 'ffffffff', status: 'good' },
          ],
        },
      ],
    };
    const filesNoCrc: ArchiveFile[] = [{ name: 'Super Mario World (USA).sfc', size: 524288 }];
    vi.mocked(getIndex).mockResolvedValue(filesNoCrc);

    const results = await resolveGames(headerlessDat, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[0]?.sources[0]?.verified).toBe(false);
  });

  it('does not name-match a re-encoded dump (.chd) against a raw-bytes ROM entry', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    // Same basename, re-encoded container — would otherwise pass the
    // extension-agnostic name match and hand the downloader a file
    // guaranteed to fail its CRC check (see docs/archive-org-strategy.md).
    vi.mocked(getIndex).mockResolvedValue([{ name: 'Super Mario World (USA).chd', size: 524288 }]);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(0);
  });

  it('matches files nested in subdirectories by basename', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue([
      { name: 'snes/us/Super Mario World (USA).sfc', size: 524288 },
    ]);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
  });

  it('lists a nodump ROM with no sources, without querying any source', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    const nodumpDat: DatFile = {
      source: 'no-intro',
      system: 'Nintendo - Super Nintendo Entertainment System',
      games: [
        {
          id: 'proto',
          name: 'Unreleased Prototype (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [{ name: 'Unreleased Prototype (USA).sfc', size: 524288, status: 'nodump' }],
        },
      ],
    };

    const results = await resolveGames(nodumpDat, 'dat1', ['proto']);
    expect(results[0]?.roms[0]?.sources).toEqual([]);
    expect(vi.mocked(getItemInfo)).not.toHaveBeenCalled();
  });
});

describe('resolveGames — restricted item via datanode zip listing', () => {
  it('resolves through view_archive matching the re-zipped inner name', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'ni-like',
      layout: 'zip-collection',
      note: '',
    });
    // Restricted item: file list is the per-system ZIPs, no per-ROM matches
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: 'roms/Nintendo - Super Nintendo Entertainment System.zip', size: 9e9 }],
      restricted: true,
      server: 'ia800000.us.archive.org',
      dir: '/17/items/ni-like',
    });
    // Inside the system ZIP, the ROM is re-zipped as "<name>.zip"
    vi.mocked(getZipListing).mockResolvedValue(['Super Mario World (USA).zip']);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    const src = results[0]?.roms[0]?.sources[0];
    expect(src?.container).toBe('zip-view');
    expect(src?.downloadUrl).toContain('ia800000.us.archive.org/view_archive.php');
    expect(src?.downloadUrl).toContain('Super%20Mario%20World%20(USA).zip');
    // A datanode listing only gives names, never hashes.
    expect(src?.verified).toBe(false);
    // The matched inner entry is itself re-zipped ("<name>.zip") — ni-roms's
    // own layout, distinct from a Redump per-game zip's raw inner files.
    expect(src?.extractFromZip).toBe(true);
  });

  it('returns no source when the inner listing has no matching entry', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'ni-like',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: 'roms/Nintendo - Super Nintendo Entertainment System.zip', size: 9e9 }],
      restricted: true,
      server: 'ia800000.us.archive.org',
      dir: '/17/items/ni-like',
    });
    vi.mocked(getZipListing).mockResolvedValue(['Some Other Game (USA).zip']);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(0);
  });

  it('does not name-match a re-encoded dump (.chd) inside a datanode zip listing', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'ni-like',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: 'roms/Nintendo - Super Nintendo Entertainment System.zip', size: 9e9 }],
      restricted: true,
      server: 'ia800000.us.archive.org',
      dir: '/17/items/ni-like',
    });
    vi.mocked(getZipListing).mockResolvedValue(['Super Mario World (USA).chd']);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(0);
  });

  it('does not let an unrelated system-name mention crowd out an exact per-game zip match', async () => {
    // Reproduces the real Redump case: sony_playstation_part1 is a
    // restricted per-game-zip collection, so "Bloody Roar (USA).zip" never
    // mentions "PlayStation" itself — while plenty of *other* games' zips
    // coincidentally do ("... (PlayStation Taiou).zip", a tie-in subtitle).
    // The system-name filter must not let those crowd the real match out of
    // the only two candidate slots that get a datanode listing fetched.
    addSource('Sony - PlayStation', {
      identifier: 'sony_playstation_part1',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [
        { name: '10th Anniversary Memorial Save Data (PlayStation Taiou).zip', size: 1 },
        { name: 'A Ressha de Ikou 4 - Evolution Global (PlayStation the Best).zip', size: 1 },
        { name: 'Bloody Roar (USA).zip', size: 1 },
      ],
      restricted: true,
      server: 'ia801505.us.archive.org',
      dir: '/0/items/sony_playstation_part1',
    });
    vi.mocked(getZipListing).mockResolvedValue([
      'Bloody Roar (USA) (Track 1).bin',
      'Bloody Roar (USA) (Track 2).bin',
      'Bloody Roar (USA).cue',
    ]);

    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar',
          name: 'Bloody Roar (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            {
              name: 'Bloody Roar (USA) (Track 1).bin',
              size: 575630832,
              crc: 'b8f3aadb',
              status: 'good',
            },
          ],
        },
      ],
    };

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain('Bloody%20Roar%20(USA).zip');
    // The two unrelated zips were never even fetched — the exact match won
    // the sort outright and didn't need the system-name fallback at all.
    expect(vi.mocked(getZipListing)).toHaveBeenCalledTimes(1);
    // Redump's per-game ZIP holds the raw .bin directly — the matched inner
    // entry is not itself re-zipped, so the downloader must not try to unzip
    // it (that would fail: the bytes aren't ZIP-formatted at all).
    expect(results[0]?.roms[0]?.sources[0]?.extractFromZip).toBe(false);
  });
});

describe('resolveGames — zip-collection layout', () => {
  it('returns the first verified zip-entry URL', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'zip-snes',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue(ZIP_FILES);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[0]?.sources[0]?.container).toBe('zip-entry');
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain('No-Intro%20SNES.zip');
    // A HEAD check confirms the path exists, never the content's hash.
    expect(results[0]?.roms[0]?.sources[0]?.verified).toBe(false);
  });

  it('probes the ZIP named after the ROM first (per-game-zip uploads)', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'zip-snes',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue([
      { name: 'Aaaa First Alphabetically.zip', size: 1, format: 'ZIP' },
      { name: 'Super Mario World (USA).zip', size: 1, format: 'ZIP' },
    ]);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    // Only one HEAD needed: the basename-matching ZIP was probed first
    expect(vi.mocked(urlExists)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(urlExists).mock.calls[0]?.[0]).toContain('Super%20Mario%20World%20(USA).zip');
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain(
      'Super%20Mario%20World%20(USA).zip',
    );
  });

  it('prioritizes a ZIP named after the system over unrelated ZIPs', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'zip-snes',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue([
      { name: 'random-extras.zip', size: 1, format: 'ZIP' },
      {
        name: 'ROMs/Nintendo - Super Nintendo Entertainment System.zip',
        size: 999,
        format: 'ZIP',
      },
    ]);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(vi.mocked(urlExists).mock.calls[0]?.[0]).toContain('Super%20Nintendo');
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain('Super%20Nintendo');
  });

  it('falls back to the next ZIP when the first candidate 404s', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'zip-snes',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue([
      { name: 'part1.zip', size: 1, format: 'ZIP' },
      { name: 'part2.zip', size: 1, format: 'ZIP' },
    ]);
    // part1 rejected on both entry layouts (plain and folder-prefixed)
    vi.mocked(urlExists)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain('part2.zip');
  });

  it('reports not found when no candidate ZIP contains the ROM', async () => {
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'zip-snes',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue(ZIP_FILES);
    vi.mocked(urlExists).mockResolvedValue(false);

    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(0);
  });

  it('finds a multi-track disc rom whose zip is named after the game, not the track', async () => {
    addSource('Sony - PlayStation', {
      identifier: 'sony_playstation_part1',
      layout: 'zip-collection',
      note: '',
    });
    // Redump bundles every track + the .cue of one game into a single ZIP
    // named after the *game* ("Bloody Roar (USA).zip") — never after an
    // individual track. Padded with five unrelated ZIPs ranked no better
    // than "everything else" so the right one would fall outside
    // MAX_ZIP_HEAD_CHECKS (5) without also ranking by game name.
    vi.mocked(getIndex).mockResolvedValue([
      ...Array.from({ length: 5 }, (_, i) => ({
        name: `Unrelated Game ${i} (USA).zip`,
        size: 1,
        format: 'ZIP',
      })),
      { name: 'Bloody Roar (USA).zip', size: 1, format: 'ZIP' },
    ]);

    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar',
          name: 'Bloody Roar (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            {
              name: 'Bloody Roar (USA) (Track 1).bin',
              size: 575630832,
              crc: 'b8f3aadb',
              status: 'good',
            },
          ],
        },
      ],
    };

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain('Bloody%20Roar%20(USA).zip');
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
    expect(results[0]?.roms[0]?.sources).toHaveLength(0);
  });

  it('returns empty result for unknown gameId', async () => {
    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['nonexistent']);
    expect(results[0]?.roms).toHaveLength(0);
    expect(results[0]?.gameName).toBe('');
  });
});

describe('resolveGames — multi-disc games', () => {
  const MULTI_DISC_DAT: DatFile = {
    source: 'redump',
    system: 'Sony - PlayStation',
    games: [
      {
        id: 'ff7',
        name: 'Final Fantasy VII (USA)',
        region: ['USA'],
        languages: ['En'],
        roms: [
          {
            name: 'Final Fantasy VII (USA) (Disc 1).bin',
            size: 1,
            crc: '00000001',
            status: 'good',
          },
          {
            name: 'Final Fantasy VII (USA) (Disc 2).bin',
            size: 1,
            crc: '00000002',
            status: 'good',
          },
          {
            name: 'Final Fantasy VII (USA) (Disc 3).bin',
            size: 1,
            crc: '00000003',
            status: 'good',
          },
        ],
      },
    ],
  };

  it('resolves every disc, reporting the missing ones', async () => {
    addSource('Sony - PlayStation', {
      identifier: 'direct-psx',
      layout: 'direct',
      note: '',
    });
    // Only discs 1 and 2 are present in the collection
    vi.mocked(getIndex).mockResolvedValue([
      { name: 'Final Fantasy VII (USA) (Disc 1).bin', size: 1, crc32: '00000001' },
      { name: 'Final Fantasy VII (USA) (Disc 2).bin', size: 1, crc32: '00000002' },
    ]);

    const results = await resolveGames(MULTI_DISC_DAT, 'dat2', ['ff7']);
    removeSource('direct-psx', 'Sony - PlayStation');

    expect(results[0]?.gameName).toBe('Final Fantasy VII (USA)');
    expect(results[0]?.roms).toHaveLength(3);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[1]?.sources).toHaveLength(1);
    expect(results[0]?.roms[2]?.sources).toHaveLength(0);
  });
});
