import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveGames,
  clearResolverCache,
  selectSources,
} from '../services/archive-org/resolver.js';
import { addSource, removeSource, setSourceSearched } from '../services/archive-org/sources.js';
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
  removeSource('rr-sony-playstation-u', 'Sony - PlayStation');
  removeSource('rr-sony-rar-u', 'Sony - PlayStation');
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

  it("disambiguates by extension when a disc game's own sibling files share a stripped base name", async () => {
    // A single-track disc game's .bin and .cue both strip down to the same
    // base ("Bloody Roar II (USA)") — without preferring the exact
    // (extension-included) name first, resolving the .cue ROM could return
    // the .bin file instead, since both pass the stripped-base filter.
    addSource('Sony - PlayStation', { identifier: 'direct-psx', layout: 'direct', note: '' });
    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar-2',
          name: 'Bloody Roar II (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            { name: 'Bloody Roar II (USA).bin', size: 291650000, crc: 'f5ec130a', status: 'good' },
            { name: 'Bloody Roar II (USA).cue', size: 86, crc: '5679034e', status: 'good' },
          ],
        },
      ],
    };
    // No crc32 in the archive metadata — forces the byName fallback.
    vi.mocked(getIndex).mockResolvedValue([
      { name: 'Bloody Roar II (USA).bin', size: 291650000 },
      { name: 'Bloody Roar II (USA).cue', size: 86 },
    ]);

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar-2']);
    removeSource('direct-psx', 'Sony - PlayStation');

    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain(
      encodeURIComponent('Bloody Roar II (USA).bin'),
    );
    expect(results[0]?.roms[1]?.sources[0]?.downloadUrl).toContain(
      encodeURIComponent('Bloody Roar II (USA).cue'),
    );
  });

  it("does not fall back to a sibling rom's own file when this rom has no real match at all", async () => {
    // Same real bug as the restricted-zip-listing case, but for a direct
    // layout: only the .bin is actually present (wrongly named or just
    // missing the .cue) — findMatch must not hand the .cue rom the .bin
    // file just because both share the stripped base.
    addSource('Sony - PlayStation', { identifier: 'direct-psx', layout: 'direct', note: '' });
    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar-2',
          name: 'Bloody Roar II (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            { name: 'Bloody Roar II (USA).bin', size: 291650000, crc: 'f5ec130a', status: 'good' },
            { name: 'Bloody Roar II (USA).cue', size: 86, crc: '5679034e', status: 'good' },
          ],
        },
      ],
    };
    // No crc32, and no file named after the .cue at all.
    vi.mocked(getIndex).mockResolvedValue([{ name: 'Bloody Roar II (USA).bin', size: 291650000 }]);

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar-2']);
    removeSource('direct-psx', 'Sony - PlayStation');

    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain(
      encodeURIComponent('Bloody Roar II (USA).bin'),
    );
    expect(results[0]?.roms[1]?.sources).toHaveLength(0);
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

  it('does not name-match an archive container (.7z) against a raw-bytes ROM entry on a direct-layout source', async () => {
    // Reproduces the real bug: a mis-detected `direct` source whose files
    // are actually per-game .7z containers (Redump's rr-sony-playstation-*)
    // matched the compressed .7z itself as the ROM — downloaded fine (no
    // extraction needed for a direct layout) but never passes CRC, since a
    // .7z's own bytes are never the raw ROM's bytes.
    addSource('Nintendo - Super Nintendo Entertainment System', {
      identifier: 'direct-snes',
      layout: 'direct',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue([
      { name: 'Super Mario World (USA).7z', size: 524288, format: '7z' },
    ]);

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
    // A system-wide bundle (the zip is named after the whole system, not
    // this game) must never get the archive-container fast path — fetching
    // a 9GB system-wide zip whole to pull out one game would be wasteful.
    expect(src?.container).toBe('zip-view');
    expect(src?.fallback).toBeUndefined();
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
    const src = results[0]?.roms[0]?.sources[0];
    expect(src?.downloadUrl).toContain('Bloody%20Roar%20(USA).zip');
    // The two unrelated zips were never even fetched — the exact match won
    // the sort outright and didn't need the system-name fallback at all.
    expect(vi.mocked(getZipListing)).toHaveBeenCalledTimes(1);
    // Redump's per-game ZIP holds the raw .bin directly — the matched inner
    // entry is not itself re-zipped, so the downloader must not try to unzip
    // it (that would fail: the bytes aren't ZIP-formatted at all).
    expect(src?.extractFromZip).toBe(false);
    // An exact per-game match gets the fast whole-container path, with the
    // slower zip-view resolution tucked away as its fallback.
    expect(src?.container).toBe('archive-container');
    expect(src?.innerPath).toBe('Bloody Roar (USA) (Track 1).bin');
    expect(src?.archiveFormat).toBe('zip');
    expect(src?.fallback?.container).toBe('zip-view');
    expect(src?.fallback?.downloadUrl).toContain('view_archive.php');
  });

  it('resolves a per-game .7z collection (Redump rr-sony-playstation-* style)', async () => {
    // The actual bug report: "Bloody Roar II" from rr-sony-playstation-u —
    // a restricted item whose per-game archives are .7z, not .zip.
    addSource('Sony - PlayStation', {
      identifier: 'rr-sony-playstation-u',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: 'usa/Bloody Roar II (USA).7z', size: 291655606, format: '7z' }],
      restricted: true,
      server: 'ia600407.us.archive.org',
      dir: '/11/items/rr-sony-playstation-u',
    });
    vi.mocked(getZipListing).mockResolvedValue([
      'Bloody Roar II (USA).bin',
      'Bloody Roar II (USA).cue',
    ]);

    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar-2',
          name: 'Bloody Roar II (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            { name: 'Bloody Roar II (USA).bin', size: 291650000, crc: 'f5ec130a', status: 'good' },
            { name: 'Bloody Roar II (USA).cue', size: 86, crc: '5679034e', status: 'good' },
          ],
        },
      ],
    };

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar-2']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[1]?.sources).toHaveLength(1);
    const bin = results[0]?.roms[0]?.sources[0];
    const cue = results[0]?.roms[1]?.sources[0];

    // An exact per-game match gets the fast whole-container path — the
    // primary downloadUrl is the whole .7z, fetched once and shared by both
    // roms (see downloader/index.ts's getOrFetchContainer); extractFromZip
    // is irrelevant here (the container's own extraction step handles it).
    expect(bin?.container).toBe('archive-container');
    expect(bin?.downloadUrl).toContain('Bloody%20Roar%20II%20(USA).7z');
    expect(bin?.extractFromZip).toBe(false);
    expect(bin?.archiveFormat).toBe('7z');
    expect(cue?.downloadUrl).toBe(bin?.downloadUrl);

    // This is a single-track disc: both roms' stripped base name equals the
    // game name ("Bloody Roar II (USA)"), so the inner-entry match must
    // disambiguate by extension too — otherwise both roms would resolve to
    // whichever of .bin/.cue the datanode listing happens to list first.
    // That disambiguation now lives in innerPath (and in the fallback's own
    // downloadUrl, still pointing at the specific inner entry via
    // view_archive.php).
    expect(bin?.innerPath).toBe('Bloody Roar II (USA).bin');
    expect(cue?.innerPath).toBe('Bloody Roar II (USA).cue');
    expect(bin?.fallback?.container).toBe('zip-view');
    expect(bin?.fallback?.downloadUrl).toContain(encodeURIComponent('Bloody Roar II (USA).bin'));
    expect(cue?.fallback?.downloadUrl).toContain(encodeURIComponent('Bloody Roar II (USA).cue'));
  });

  it('resolves a per-game .rar collection the same way as .7z', async () => {
    addSource('Sony - PlayStation', {
      identifier: 'rr-sony-rar-u',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: 'usa/Bloody Roar II (USA).rar', size: 291655606, format: 'rar' }],
      restricted: true,
      server: 'ia600407.us.archive.org',
      dir: '/11/items/rr-sony-rar-u',
    });
    vi.mocked(getZipListing).mockResolvedValue(['Bloody Roar II (USA).bin']);

    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar-2',
          name: 'Bloody Roar II (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            { name: 'Bloody Roar II (USA).bin', size: 291650000, crc: 'f5ec130a', status: 'good' },
          ],
        },
      ],
    };

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar-2']);
    const src = results[0]?.roms[0]?.sources[0];
    expect(src?.container).toBe('archive-container');
    expect(src?.archiveFormat).toBe('rar');
    expect(src?.innerPath).toBe('Bloody Roar II (USA).bin');
  });

  it('trusts romName directly as the archive-container innerPath, ignoring a mis-rendered listing entry', async () => {
    // The real bug: rr-sony-playstation-u's own view_archive.php listing
    // renders the .cue's inner name truncated — "Roar II (USA).cue" — even
    // though the real archive (downloaded and opened by hand to confirm)
    // correctly stores it as "Bloody Roar II (USA).cue". Before this fix,
    // the resolver only trusted the listing to say what the inner path
    // was, so a mis-rendered entry meant never finding it (worse, an
    // earlier version of this fix fell back to the sibling .bin instead,
    // which would download fine but always fail CRC). Since the
    // archive-container path extracts locally via 7z-wasm — which reads
    // the archive's own real file table, not this listing — it doesn't
    // need the listing to be right at all; it just tries the DAT's own
    // romName directly.
    addSource('Sony - PlayStation', {
      identifier: 'rr-sony-playstation-u',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: 'usa/Bloody Roar II (USA).7z', size: 291655606, format: '7z' }],
      restricted: true,
      server: 'ia600407.us.archive.org',
      dir: '/11/items/rr-sony-playstation-u',
    });
    vi.mocked(getZipListing).mockResolvedValue([
      'Bloody Roar II (USA).bin',
      'Roar II (USA).cue', // truncated — does not strip to romBase or gameName
    ]);

    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar-2',
          name: 'Bloody Roar II (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            { name: 'Bloody Roar II (USA).bin', size: 291650000, crc: 'f5ec130a', status: 'good' },
            { name: 'Bloody Roar II (USA).cue', size: 86, crc: '5679034e', status: 'good' },
          ],
        },
      ],
    };

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar-2']);
    expect(results[0]?.roms[0]?.sources).toHaveLength(1);
    expect(results[0]?.roms[0]?.sources[0]?.innerPath).toBe('Bloody Roar II (USA).bin');
    // The .cue resolves too, with innerPath guessed directly from romName —
    // not derived from (or blocked by) the listing's wrong entry at all.
    // No fallback either: the listing never produced a usable zip-view
    // candidate for this rom to fall back to.
    expect(results[0]?.roms[1]?.sources).toHaveLength(1);
    expect(results[0]?.roms[1]?.sources[0]?.innerPath).toBe('Bloody Roar II (USA).cue');
    expect(results[0]?.roms[1]?.sources[0]?.container).toBe('archive-container');
    expect(results[0]?.roms[1]?.sources[0]?.fallback).toBeUndefined();
  });

  it('still resolves an exact per-game match even when the listing fetch fails outright', async () => {
    addSource('Sony - PlayStation', {
      identifier: 'rr-sony-playstation-u',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: 'usa/Bloody Roar II (USA).7z', size: 291655606, format: '7z' }],
      restricted: true,
      server: 'ia600407.us.archive.org',
      dir: '/11/items/rr-sony-playstation-u',
    });
    vi.mocked(getZipListing).mockRejectedValue(new Error('network error'));

    const discDat: DatFile = {
      source: 'redump',
      system: 'Sony - PlayStation',
      games: [
        {
          id: 'bloody-roar-2',
          name: 'Bloody Roar II (USA)',
          region: ['USA'],
          languages: ['En'],
          roms: [
            { name: 'Bloody Roar II (USA).bin', size: 291650000, crc: 'f5ec130a', status: 'good' },
          ],
        },
      ],
    };

    const results = await resolveGames(discDat, 'dat1', ['bloody-roar-2']);
    const src = results[0]?.roms[0]?.sources[0];
    expect(src?.container).toBe('archive-container');
    expect(src?.innerPath).toBe('Bloody Roar II (USA).bin');
    expect(src?.fallback).toBeUndefined();
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
    const fetchesAfterFirstRun = vi.mocked(getIndex).mock.calls.length;
    await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(vi.mocked(getIndex)).toHaveBeenCalledTimes(fetchesAfterFirstRun);
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

describe('resolveGames — sources switched off', () => {
  const SNES = 'Nintendo - Super Nintendo Entertainment System';

  beforeEach(() => {
    addSource(SNES, { identifier: 'direct-snes', layout: 'direct', note: '' });
    addSource(SNES, { identifier: 'zip-snes', layout: 'direct', note: '' });
    setSourceSearched('direct-snes', SNES, true);
    setSourceSearched('zip-snes', SNES, true);
    vi.mocked(getIndex).mockResolvedValue(DIRECT_FILES);
  });

  it('searches every source while all are on', async () => {
    await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    const queried = vi.mocked(getItemInfo).mock.calls.map(([id]) => id);
    expect(new Set(queried)).toEqual(new Set(['direct-snes', 'zip-snes']));
  });

  it('skips a switched-off source', async () => {
    setSourceSearched('direct-snes', SNES, false);
    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    const queried = vi.mocked(getItemInfo).mock.calls.map(([id]) => id);
    expect(new Set(queried)).toEqual(new Set(['zip-snes']));
    expect(results[0]?.roms[0]?.sources.map((source) => source.identifier)).toEqual(['zip-snes']);
  });

  // A run over one source must not be served to a run over all of them.
  it('keeps a narrowed run out of the cache of a full one', async () => {
    setSourceSearched('direct-snes', SNES, false);
    await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    setSourceSearched('direct-snes', SNES, true);
    const results = await resolveGames(FIXTURE_DAT, 'dat1', ['smw']);
    expect(results[0]?.roms[0]?.sources.map((source) => source.identifier)).toEqual([
      'direct-snes',
      'zip-snes',
    ]);
  });
});

describe('selectSources', () => {
  const on = (identifier: string) => ({
    identifier,
    layout: 'direct' as const,
    note: '',
    searched: true,
  });

  it('keeps every source, in configured order, while all are on', () => {
    const configured = [on('b'), on('a')];
    expect(selectSources(configured)).toEqual({ sources: configured, scope: '*' });
  });

  it('leaves out the switched-off ones', () => {
    const configured = [on('b'), { ...on('a'), searched: false }];
    expect(selectSources(configured).sources.map((source) => source.identifier)).toEqual(['b']);
  });

  it('names the same set the same way, whatever the configured order', () => {
    const off = { ...on('c'), searched: false };
    expect(selectSources([on('a'), on('b'), off]).scope).toBe(
      selectSources([on('b'), on('a'), off]).scope,
    );
  });
});
describe('resolveGames — upload older than the DAT name', () => {
  const N64 = 'Nintendo - Nintendo 64 (BigEndian)';
  const LODGENET_DAT: DatFile = {
    source: 'no-intro',
    system: N64,
    games: [
      {
        id: '1080',
        name: '1080 Snowboarding (USA) (En,Ja,Fr,De) (LodgeNet)',
        region: ['USA'],
        languages: ['En', 'Ja', 'Fr', 'De'],
        roms: [
          {
            name: '1080 Snowboarding (USA) (En,Ja,Fr,De) (LodgeNet).z64',
            size: 16777216,
            crc: '67e010d2',
            status: 'good',
          },
        ],
      },
    ],
  };
  const OLD_NAME = '1080 Snowboarding (USA) (En,Ja) (LodgeNet)';

  beforeEach(() => {
    for (const id of ['old-direct', 'old-zips', 'old-restricted', 'new-direct']) {
      removeSource(id, N64);
    }
  });

  it('finds a per-game zip named before the languages changed, and its real entry', async () => {
    addSource(N64, {
      identifier: 'old-zips',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getIndex).mockResolvedValue([
      { name: `mnt/N64/${OLD_NAME}.zip`, size: 11263640, format: 'ZIP' },
    ]);

    const results = await resolveGames(LODGENET_DAT, 'dat1', ['1080']);
    const src = results[0]?.roms[0]?.sources[0];
    expect(src?.container).toBe('zip-entry');
    expect(src?.downloadUrl).toContain(encodeURIComponent(`${OLD_NAME}.z64`));
    expect(src?.verified).toBe(false);
  });

  it('finds a raw file named before the languages changed', async () => {
    addSource(N64, { identifier: 'old-direct', layout: 'direct', note: '' });
    vi.mocked(getIndex).mockResolvedValue([
      { name: `${OLD_NAME}.z64`, size: 16777216, format: 'N64 ROM' },
    ]);

    const results = await resolveGames(LODGENET_DAT, 'dat1', ['1080']);
    expect(results[0]?.roms[0]?.sources[0]?.downloadUrl).toContain(
      encodeURIComponent(`${OLD_NAME}.z64`),
    );
  });

  it('extracts the entry under its old name from a restricted per-game zip', async () => {
    addSource(N64, {
      identifier: 'old-restricted',
      layout: 'zip-collection',
      note: '',
    });
    vi.mocked(getItemInfo).mockResolvedValue({
      files: [{ name: `${OLD_NAME}.zip`, size: 11263640, format: 'ZIP' }],
      restricted: true,
      server: 'ia800000.us.archive.org',
      dir: '/1/items/old-restricted',
    });
    vi.mocked(getZipListing).mockResolvedValue([`${OLD_NAME}.i64`, `${OLD_NAME}.z64`]);

    const results = await resolveGames(LODGENET_DAT, 'dat1', ['1080']);
    const src = results[0]?.roms[0]?.sources[0];
    expect(src?.container).toBe('archive-container');
    expect(src?.innerPath).toBe(`${OLD_NAME}.z64`);
    expect(src?.fallback?.downloadUrl).toContain(encodeURIComponent(`${OLD_NAME}.z64`));
  });

  it('lists a renamed match after an exact one, whatever the source order', async () => {
    addSource(N64, { identifier: 'old-direct', layout: 'direct', note: '' });
    addSource(N64, { identifier: 'new-direct', layout: 'direct', note: '' });
    vi.mocked(getIndex).mockImplementation(async (id: string) =>
      id === 'old-direct'
        ? [{ name: `${OLD_NAME}.z64`, size: 1, format: 'N64 ROM' }]
        : [
            {
              name: '1080 Snowboarding (USA) (En,Ja,Fr,De) (LodgeNet).z64',
              size: 1,
              format: 'N64 ROM',
            },
          ],
    );

    const results = await resolveGames(LODGENET_DAT, 'dat1', ['1080']);
    expect(results[0]?.roms[0]?.sources.map((s) => s.identifier)).toEqual([
      'new-direct',
      'old-direct',
    ]);
  });

  it('does not take another region or version for a renamed one', async () => {
    addSource(N64, { identifier: 'old-direct', layout: 'direct', note: '' });
    vi.mocked(getIndex).mockResolvedValue([
      {
        name: '1080 Snowboarding (Japan, USA) (En,Ja).z64',
        size: 1,
        format: 'N64 ROM',
      },
      {
        name: '1080 Snowboarding (USA) (En,Ja).z64',
        size: 1,
        format: 'N64 ROM',
      },
    ]);

    const results = await resolveGames(LODGENET_DAT, 'dat1', ['1080']);
    expect(results[0]?.roms[0]?.sources).toEqual([]);
  });
});
