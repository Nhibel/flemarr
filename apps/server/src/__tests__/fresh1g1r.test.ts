import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '../lib/db.js';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => join(actual.tmpdir(), 'flemarr-fresh1g1r-test'),
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

// Top-level `daily-1g1r-dat` listing — gives each preset's own tree sha.
const PRESET_DIRS_RESPONSE = [
  { name: 'PropeR', path: 'daily-1g1r-dat/PropeR', sha: 'preset-sha-proper', type: 'dir' },
  { name: 'McLean', path: 'daily-1g1r-dat/McLean', sha: 'preset-sha-mclean', type: 'dir' },
];

// Recursive tree scoped to one preset — paths are relative to it.
const PROPER_TREE_RESPONSE = {
  tree: [
    { path: 'no-intro', type: 'tree', sha: 'tree-no-intro' },
    {
      path: 'no-intro/Nintendo - Super Nintendo Entertainment System (No-Intro - Fresh1G1R - PropeR).dat',
      type: 'blob',
      sha: 'abc123def456',
    },
    { path: 'no-intro/README.md', type: 'blob', sha: 'aaaa' },
    { path: 'redump', type: 'tree', sha: 'tree-redump' },
    {
      path: 'redump/Sony - PlayStation (Redump - Fresh1G1R - PropeR).dat',
      type: 'blob',
      sha: 'deadbeef1234',
    },
  ],
};

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
  await rm(join(tmpdir(), 'flemarr-fresh1g1r-test'), { recursive: true, force: true });
});

describe('listDatSources', () => {
  it('returns only .dat files, not README etc.', async () => {
    mockFetch([
      { url: /\/contents\/daily-1g1r-dat$/, body: PRESET_DIRS_RESPONSE },
      { url: /\/git\/trees\//, body: PROPER_TREE_RESPONSE },
    ]);
    const sources = await listDatSources('PropeR');
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s.name.endsWith('.dat'))).toBe(true);
  });

  it('extracts system name, stripping the Fresh1G1R suffix', async () => {
    mockFetch([
      { url: /\/contents\/daily-1g1r-dat$/, body: PRESET_DIRS_RESPONSE },
      { url: /\/git\/trees\//, body: PROPER_TREE_RESPONSE },
    ]);
    const sources = await listDatSources('PropeR');
    const systems = sources.map((s) => s.system);
    expect(systems).toContain('Nintendo - Super Nintendo Entertainment System');
    expect(systems).toContain('Sony - PlayStation');
  });

  it('reconstructs the full repo-relative path for each entry', async () => {
    mockFetch([
      { url: /\/contents\/daily-1g1r-dat$/, body: PRESET_DIRS_RESPONSE },
      { url: /\/git\/trees\//, body: PROPER_TREE_RESPONSE },
    ]);
    const sources = await listDatSources('PropeR');
    const snes = sources.find((s) => s.system.includes('Super Nintendo'));
    expect(snes?.path).toBe(
      'daily-1g1r-dat/PropeR/no-intro/Nintendo - Super Nintendo Entertainment System (No-Intro - Fresh1G1R - PropeR).dat',
    );
  });

  it('returns an empty list when the preset folder is absent', async () => {
    mockFetch([{ url: /\/contents\/daily-1g1r-dat$/, body: PRESET_DIRS_RESPONSE }]);
    const sources = await listDatSources('Hearto');
    expect(sources).toEqual([]);
  });

  it('retries once on a 503 from the preset listing, then succeeds', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (/\/contents\/daily-1g1r-dat$/.test(url)) {
          calls++;
          if (calls === 1) {
            return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve(null) });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(PRESET_DIRS_RESPONSE),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(PROPER_TREE_RESPONSE),
        });
      }),
    );
    const sources = await listDatSources('PropeR');
    expect(calls).toBe(2);
    expect(sources).toHaveLength(2);
  });

  it('throws when GitHub returns a non-retryable error', async () => {
    mockFetch([{ url: /\/contents\/daily-1g1r-dat$/, body: null, status: 403 }]);
    await expect(listDatSources('PropeR')).rejects.toThrow('GitHub API returned 403');
  });

  it('throws when the exhausted retries still fail', async () => {
    mockFetch([{ url: /\/contents\/daily-1g1r-dat$/, body: null, status: 503 }]);
    await expect(listDatSources('PropeR')).rejects.toThrow('GitHub API returned 503');
  });

  it('throws when GitHub response has unexpected shape', async () => {
    mockFetch([{ url: /\/contents\/daily-1g1r-dat$/, body: { unexpected: true } }]);
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
