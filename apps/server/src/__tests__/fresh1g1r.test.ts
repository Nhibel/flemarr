import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '../lib/db.js';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => join(actual.tmpdir(), 'rom-curator-fresh1g1r-test'),
  };
});

import { listDatSources, fetchDat } from '../services/fresh1g1r/index.js';

const MINIMAL_DAT = `<?xml version="1.0"?>
<!DOCTYPE datafile PUBLIC "-//Logiqx//DTD ROM Management Datafile//EN" "http://www.logiqx.com/Dats/datafile.dtd">
<datafile>
  <header>
    <name>Nintendo - Super Nintendo Entertainment System</name>
    <description>Nintendo - Super Nintendo Entertainment System</description>
    <url>https://www.no-intro.org</url>
  </header>
  <game name="Test Game (USA)">
    <description>Test Game (USA)</description>
    <rom name="Test Game (USA).sfc" size="524288" crc="b19ed489" md5="00000000000000000000000000000000" sha1="0000000000000000000000000000000000000000"/>
  </game>
</datafile>`;

const NO_INTRO_RESPONSE = [
  {
    name: 'Nintendo - Super Nintendo Entertainment System (No-Intro - Fresh1G1R - PropeR).dat',
    path: 'daily-1g1r-dat/PropeR/no-intro/Nintendo - Super Nintendo Entertainment System (No-Intro - Fresh1G1R - PropeR).dat',
    sha: 'abc123def456',
    type: 'file',
  },
  {
    name: 'README.md',
    path: 'daily-1g1r-dat/PropeR/no-intro/README.md',
    sha: 'aaaa',
    type: 'file',
  },
];

const REDUMP_RESPONSE = [
  {
    name: 'Sony - PlayStation (Redump - Fresh1G1R - PropeR).dat',
    path: 'daily-1g1r-dat/PropeR/redump/Sony - PlayStation (Redump - Fresh1G1R - PropeR).dat',
    sha: 'deadbeef1234',
    type: 'file',
  },
];

function mockFetch(responses: { url: RegExp; body: unknown; status?: number }[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      const match = responses.find((r) => r.url.test(url));
      const status = match?.status ?? 200;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        text: () =>
          Promise.resolve(
            typeof match?.body === 'string' ? match.body : JSON.stringify(match?.body),
          ),
        json: () => Promise.resolve(match?.body),
      });
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(async () => {
  closeDb(); // release SQLite file lock before deleting the temp dir
  await rm(join(tmpdir(), 'rom-curator-fresh1g1r-test'), { recursive: true, force: true });
});

describe('listDatSources', () => {
  it('returns only .dat files, not README etc.', async () => {
    mockFetch([
      { url: /\/no-intro/, body: NO_INTRO_RESPONSE },
      { url: /\/redump/, body: REDUMP_RESPONSE },
    ]);
    const sources = await listDatSources('PropeR');
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s.name.endsWith('.dat'))).toBe(true);
  });

  it('extracts system name, stripping the Fresh1G1R suffix', async () => {
    mockFetch([
      { url: /\/no-intro/, body: NO_INTRO_RESPONSE },
      { url: /\/redump/, body: REDUMP_RESPONSE },
    ]);
    const sources = await listDatSources('PropeR');
    const systems = sources.map((s) => s.system);
    expect(systems).toContain('Nintendo - Super Nintendo Entertainment System');
    expect(systems).toContain('Sony - PlayStation');
  });

  it('skips a subdir that returns 404 instead of throwing', async () => {
    mockFetch([
      { url: /\/no-intro/, body: NO_INTRO_RESPONSE },
      { url: /\/redump/, body: null, status: 404 },
    ]);
    const sources = await listDatSources('PropeR');
    expect(sources).toHaveLength(1);
  });

  it('throws when GitHub returns a non-404 error', async () => {
    mockFetch([
      { url: /\/no-intro/, body: null, status: 503 },
      { url: /\/redump/, body: REDUMP_RESPONSE },
    ]);
    await expect(listDatSources('PropeR')).rejects.toThrow('GitHub API returned 503');
  });

  it('throws when GitHub response has unexpected shape', async () => {
    mockFetch([
      { url: /\/no-intro/, body: { unexpected: true } },
      { url: /\/redump/, body: null, status: 404 },
    ]);
    await expect(listDatSources('PropeR')).rejects.toThrow('Unexpected GitHub API response shape');
  });
});

describe('fetchDat', () => {
  it('downloads and registers a DAT, returns summary', async () => {
    mockFetch([{ url: /raw\.githubusercontent/, body: MINIMAL_DAT }]);
    const summary = await fetchDat(
      'PropeR',
      'PropeR/Nintendo - Super Nintendo Entertainment System.dat',
      'sha-001',
    );
    expect(summary.system).toBe('Nintendo - Super Nintendo Entertainment System');
    expect(summary.gameCount).toBe(1);
    expect(summary.source).toBe('no-intro');
  });

  it('uses disk cache on second call — does not refetch', async () => {
    mockFetch([{ url: /raw\.githubusercontent/, body: MINIMAL_DAT }]);
    await fetchDat('PropeR', 'PropeR/test.dat', 'sha-002');
    await fetchDat('PropeR', 'PropeR/test.dat', 'sha-002');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('fetches again when SHA changes (cache miss)', async () => {
    mockFetch([{ url: /raw\.githubusercontent/, body: MINIMAL_DAT }]);
    await fetchDat('PropeR', 'PropeR/test.dat', 'sha-003a');
    await fetchDat('PropeR', 'PropeR/test.dat', 'sha-003b');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('throws when download fails', async () => {
    mockFetch([{ url: /raw\.githubusercontent/, body: null, status: 404 }]);
    await expect(fetchDat('PropeR', 'PropeR/missing.dat', 'sha-004')).rejects.toThrow('HTTP 404');
  });
});
