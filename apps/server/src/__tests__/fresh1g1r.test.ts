import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { listDatSources, fetchDat } from '../services/fresh1g1r/index.js';
import { forgetAssetIndexes } from '../services/fresh1g1r/release-asset.js';
import { dataDir } from '../lib/db.js';
import { stubReleases, zipOf } from './helpers/fake-releases.js';

function datOf(game: string): string {
  return `<?xml version="1.0"?>
<!DOCTYPE datafile PUBLIC "-//Logiqx//DTD ROM Management Datafile//EN" "http://www.logiqx.com/Dats/datafile.dtd">
<datafile>
  <header>
    <name>Nintendo - Super Nintendo Entertainment System</name>
    <description>Nintendo - Super Nintendo Entertainment System</description>
    <url>https://www.no-intro.org</url>
  </header>
  <game name="${game}">
    <description>${game}</description>
    <rom name="${game}.sfc" size="524288" crc="b19ed489" md5="00000000000000000000000000000000" sha1="0000000000000000000000000000000000000000"/>
  </game>
</datafile>`;
}

const SNES_FILE =
  'Nintendo - Super Nintendo Entertainment System (No-Intro - Fresh1G1R - PropeR).dat';
const PSX_FILE = 'Sony - PlayStation (Redump - Fresh1G1R - PropeR).dat';
const SNES_PATH = `daily-1g1r-dat/PropeR/no-intro/${SNES_FILE}`;
const UNCACHED = '00000000-1';

function properAssets(game = 'Test Game (USA)') {
  return {
    'Fresh1G1R-PropeR-No-Intro.zip': zipOf({ 'README.md': 'x', [SNES_FILE]: datOf(game) }),
    'Fresh1G1R-PropeR-Redump.zip': zipOf({ [PSX_FILE]: datOf(game) }),
  };
}

beforeEach(() => {
  forgetAssetIndexes();
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 500 });
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await rm(join(dataDir(), 'cache'), { recursive: true, force: true });
});

describe('listDatSources', () => {
  it('lists the DATs of both collections, without other files', async () => {
    stubReleases({ assets: properAssets() });
    const sources = await listDatSources('PropeR');
    expect(sources.map((s) => s.system)).toEqual([
      'Nintendo - Super Nintendo Entertainment System',
      'Sony - PlayStation',
    ]);
  });

  // The path is stored with each loaded DAT: those loaded before the releases
  // must still be found.
  it('keeps the paths DATs had in the repository', async () => {
    stubReleases({ assets: properAssets() });
    const sources = await listDatSources('PropeR');
    expect(sources.map((s) => s.path)).toEqual([
      SNES_PATH,
      `daily-1g1r-dat/PropeR/redump/${PSX_FILE}`,
    ]);
    expect(sources[0]?.revision).toMatch(/^[0-9a-f]{8}-\d+$/);
  });

  it('reads an index larger than the first range', async () => {
    const many = Object.fromEntries(
      Array.from({ length: 900 }, (_, i) => [`System ${i} ${'x'.repeat(60)}.dat`, 'x']),
    );
    const assets = { ...properAssets(), 'Fresh1G1R-PropeR-Redump.zip': zipOf(many) };
    stubReleases({ assets });
    expect(await listDatSources('PropeR')).toHaveLength(901);
  });

  it('reads the index once for a while', async () => {
    const { fetchMock } = stubReleases({ assets: properAssets() });
    await listDatSources('PropeR');
    const calls = fetchMock.mock.calls.length;
    await listDatSources('PropeR');
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('retries a gateway error', async () => {
    stubReleases({ assets: properAssets(), failures: [503] });
    expect(await listDatSources('PropeR')).toHaveLength(2);
  });

  it('fails with the status once the retries are used up', async () => {
    stubReleases({ assets: properAssets(), failures: Array<number>(6).fill(503) });
    await expect(listDatSources('PropeR')).rejects.toThrow('GitHub returned 503');
  });

  it('names the missing asset rather than returning a partial list', async () => {
    const assets = { 'Fresh1G1R-PropeR-No-Intro.zip': zipOf({ [SNES_FILE]: 'x' }) };
    stubReleases({ assets });
    await expect(listDatSources('PropeR')).rejects.toThrow(
      'GitHub returned 404 for Fresh1G1R-PropeR-Redump.zip',
    );
  });

  it('never reads a whole archive', async () => {
    stubReleases({ assets: properAssets(), ignoreRange: true });
    await expect(listDatSources('PropeR')).rejects.toThrow('Byte ranges are not served');
  });

  it('gives the network reason when GitHub is unreachable', async () => {
    const cause = Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed', { cause })));
    await expect(listDatSources('PropeR')).rejects.toThrow('ENOTFOUND');
  });
});

describe('fetchDat', () => {
  it('downloads and registers a DAT', async () => {
    stubReleases({ assets: properAssets() });
    const summary = await fetchDat('PropeR', SNES_PATH, UNCACHED);
    expect(summary).toMatchObject({
      system: 'Nintendo - Super Nintendo Entertainment System',
      gameCount: 1,
      source: 'no-intro',
    });
  });

  it('reuses a DAT it already downloaded', async () => {
    const { fetchMock } = stubReleases({ assets: properAssets() });
    const revision = (await listDatSources('PropeR'))[0]!.revision;
    await fetchDat('PropeR', SNES_PATH, revision);
    const calls = fetchMock.mock.calls.length;
    await fetchDat('PropeR', SNES_PATH, revision);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('keeps reading the release it indexed when a newer one comes out', async () => {
    const { releases, fetchMock } = stubReleases({ assets: properAssets() });
    await listDatSources('PropeR');
    releases.tag = 'daily-2';
    await fetchDat('PropeR', SNES_PATH, UNCACHED);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('/daily-1/');
  });

  it('moves to the latest release when the indexed one is gone', async () => {
    const { releases, fetchMock } = stubReleases({ assets: properAssets() });
    await listDatSources('PropeR');
    releases.tag = 'daily-2';
    releases.goneTags = ['daily-1'];
    await fetchDat('PropeR', SNES_PATH, UNCACHED);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('/daily-2/');
  });

  it('fails when the DAT is not in the release', async () => {
    stubReleases({ assets: properAssets() });
    const path = 'daily-1g1r-dat/PropeR/redump/missing.dat';
    await expect(fetchDat('PropeR', path, UNCACHED)).rejects.toThrow('is not in');
  });

  it.each(['evil.dat', 'daily-1g1r-dat/PropeR/other/a.dat', 'daily-1g1r-dat/Bad/redump/a.dat'])(
    'refuses the path %s without asking GitHub',
    async (path) => {
      const { fetchMock } = stubReleases();
      await expect(fetchDat('PropeR', path, UNCACHED)).rejects.toThrow('Unknown Fresh1G1R path');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
