import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DatFile } from '@shared/dat.js';
import { addDat, deleteDat, setDatOrigin } from '../services/dat/index.js';
import { forgetAssetIndexes } from '../services/fresh1g1r/release-asset.js';
import {
  findDatUpdates,
  forgetDatUpdates,
  publishedVersion,
} from '../services/fresh1g1r/updates.js';
import { stubReleases, zipOf } from './helpers/fake-releases.js';

const NAME = 'Updates Test (No-Intro - Fresh1G1R - PropeR).dat';
const PATH = `daily-1g1r-dat/PropeR/no-intro/${NAME}`;

const DAT: DatFile = {
  source: 'no-intro',
  system: 'Updates Test (Retool)',
  version: '20260101-000000',
  games: [],
};

// Far larger than what a version check reads.
const GAMES = Array.from({ length: 30_000 }, (_, i) => `<game name="${i * 7919}"/>`).join('');

/** A release whose No-Intro archive holds one DAT of `version`. */
function stubVersion(version: string) {
  const dat = `<header><name>x</name><version>${version}</version></header>${GAMES}`;
  return stubReleases({
    assets: {
      'Fresh1G1R-PropeR-No-Intro.zip': zipOf({ [NAME]: dat }),
      'Fresh1G1R-PropeR-Redump.zip': zipOf({}),
    },
  });
}

let datId: string;

beforeEach(() => {
  forgetAssetIndexes();
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
    stubVersion('20261120-000000');
    const revision = expect.stringMatching(/^[0-9a-f]{8}-\d+$/) as string;
    expect(await findDatUpdates()).toEqual([
      { datId, preset: 'PropeR', path: PATH, revision, version: '20261120-000000' },
    ]);
  });

  // The daily regeneration changes the file, not the set version.
  it('reports nothing when only the daily rebuild changed', async () => {
    stubVersion(DAT.version!);
    expect(await findDatUpdates()).toEqual([]);
  });

  it('skips a DAT that is no longer published', async () => {
    stubVersion('20261120-000000');
    setDatOrigin(datId, 'PropeR', 'daily-1g1r-dat/PropeR/no-intro/gone.dat');
    expect(await findDatUpdates()).toEqual([]);
  });

  it('asks GitHub again only once the last answer is old', async () => {
    const { fetchMock } = stubVersion('20261120-000000');
    await findDatUpdates(0);
    const calls = fetchMock.mock.calls.length;
    await findDatUpdates(60_000);
    expect(fetchMock.mock.calls.length).toBe(calls);
    await findDatUpdates(7 * 60 * 60 * 1000);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe('publishedVersion', () => {
  it('reads only the start of the DAT', async () => {
    const { fetchMock } = stubVersion('20261120-000000');
    expect(await publishedVersion(PATH)).toBe('20261120-000000');
    const range = new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get('range') ?? '';
    const lastByte = Number(range.split('-')[1]);
    expect(lastByte).toBeLessThan(10_000);
  });
});
