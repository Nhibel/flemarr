import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

const GITHUB_CONTENTS_RESPONSE = [
  {
    name: 'Nintendo - Super Nintendo Entertainment System.dat',
    path: 'PropeR/Nintendo - Super Nintendo Entertainment System.dat',
    sha: 'abc123def456',
    type: 'file',
  },
  {
    name: 'Sony - PlayStation.dat',
    path: 'PropeR/Sony - PlayStation.dat',
    sha: 'deadbeef1234',
    type: 'file',
  },
  {
    name: 'README.md',
    path: 'PropeR/README.md',
    sha: 'aaaa',
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
  await rm(join(tmpdir(), 'rom-curator-fresh1g1r-test'), { recursive: true, force: true });
});

describe('listDatSources', () => {
  it('returns only .dat files, not README etc.', async () => {
    mockFetch([{ url: /api\.github\.com/, body: GITHUB_CONTENTS_RESPONSE }]);
    const sources = await listDatSources('PropeR');
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s.name.endsWith('.dat'))).toBe(true);
  });

  it('extracts system name from filename', async () => {
    mockFetch([{ url: /api\.github\.com/, body: GITHUB_CONTENTS_RESPONSE }]);
    const sources = await listDatSources('PropeR');
    expect(sources[0]?.system).toBe('Nintendo - Super Nintendo Entertainment System');
    expect(sources[1]?.system).toBe('Sony - PlayStation');
  });

  it('throws when GitHub returns non-ok status', async () => {
    mockFetch([{ url: /api\.github\.com/, body: null, status: 404 }]);
    await expect(listDatSources('PropeR')).rejects.toThrow('GitHub API returned 404');
  });

  it('throws when GitHub response has unexpected shape', async () => {
    mockFetch([{ url: /api\.github\.com/, body: { unexpected: true } }]);
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
