import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DatFile } from '@shared/dat.js';
import { addDat, deleteDat, setDatOrigin } from '../services/dat/index.js';
import {
  findDatUpdates,
  forgetDatUpdates,
  publishedVersion,
} from '../services/fresh1g1r/updates.js';

const PATH = 'daily-1g1r-dat/PropeR/No-Intro/Updates Test (No-Intro - Fresh1G1R - PropeR).dat';
const SHA = 'b'.repeat(40);

const DAT: DatFile = {
  source: 'no-intro',
  system: 'Updates Test (Retool)',
  version: '20260101-000000',
  games: [],
};

/** A fake GitHub: the preset listing, its tree, and a raw DAT of `version`. */
function stubGithub(version: string) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith('/contents/daily-1g1r-dat')) {
      return Response.json([
        { name: 'PropeR', path: 'daily-1g1r-dat/PropeR', sha: 't1', type: 'dir' },
      ]);
    }
    if (url.includes('/git/trees/t1')) {
      return Response.json({
        tree: [{ path: PATH.replace('daily-1g1r-dat/PropeR/', ''), type: 'blob', sha: SHA }],
      });
    }
    return new Response(`<header><name>x</name><version>${version}</version><date>today</date>`, {
      status: 206,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let datId: string;

beforeEach(() => {
  forgetDatUpdates();
  datId = addDat(DAT).id;
  setDatOrigin(datId, 'PropeR', PATH);
});

afterEach(() => {
  deleteDat(datId);
  vi.unstubAllGlobals();
});

describe('findDatUpdates', () => {
  it('reports a DAT whose set has a newer version', async () => {
    stubGithub('20261120-000000');
    expect(await findDatUpdates()).toEqual([
      { datId, preset: 'PropeR', path: PATH, sha: SHA, version: '20261120-000000' },
    ]);
  });

  // The daily regeneration changes the file, not the set version.
  it('reports nothing when only the daily rebuild changed', async () => {
    stubGithub(DAT.version!);
    expect(await findDatUpdates()).toEqual([]);
  });

  it('asks GitHub again only once the last answer is old', async () => {
    const fetchMock = stubGithub('20261120-000000');
    await findDatUpdates(0);
    const calls = fetchMock.mock.calls.length;
    await findDatUpdates(60_000);
    expect(fetchMock.mock.calls.length).toBe(calls);
    await findDatUpdates(7 * 60 * 60 * 1000);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe('publishedVersion', () => {
  it('reads only the start of the file', async () => {
    const fetchMock = stubGithub('20261120-000000');
    expect(await publishedVersion(PATH)).toBe('20261120-000000');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ Range: 'bytes=0-4095' });
  });
});
