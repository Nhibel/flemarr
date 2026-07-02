import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { fresh1g1rRoute } from '../routes/fresh1g1r.js';

vi.mock('../services/fresh1g1r/index.js', () => ({
  listDatSources: vi.fn(),
  fetchDat: vi.fn(),
}));

import { listDatSources, fetchDat } from '../services/fresh1g1r/index.js';

const app = new Hono().route('/api', fresh1g1rRoute);

const MOCK_SOURCES = [
  {
    name: 'Nintendo - Super Nintendo Entertainment System.dat',
    system: 'Nintendo - Super Nintendo Entertainment System',
    path: 'PropeR/Nintendo - Super Nintendo Entertainment System.dat',
    sha: 'abc123',
  },
];

const VALID_SHA = 'a'.repeat(40);

const MOCK_SUMMARY = {
  id: 'dat-001',
  system: 'Nintendo - Super Nintendo Entertainment System',
  gameCount: 42,
  source: 'no-intro' as const,
};

beforeEach(() => {
  vi.mocked(listDatSources).mockReset();
  vi.mocked(fetchDat).mockReset();
});

describe('GET /api/dat-sources', () => {
  it('returns sources for the default preset (PropeR)', async () => {
    vi.mocked(listDatSources).mockResolvedValue(MOCK_SOURCES);
    const res = await app.request('/api/dat-sources');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { preset: string; sources: unknown[] };
    expect(body.preset).toBe('PropeR');
    expect(body.sources).toHaveLength(1);
    expect(vi.mocked(listDatSources)).toHaveBeenCalledWith('PropeR');
  });

  it('accepts a valid preset query param', async () => {
    vi.mocked(listDatSources).mockResolvedValue([]);
    const res = await app.request('/api/dat-sources?preset=McLean');
    expect(res.status).toBe(200);
    expect(vi.mocked(listDatSources)).toHaveBeenCalledWith('McLean');
  });

  it('returns 400 for an unknown preset', async () => {
    const res = await app.request('/api/dat-sources?preset=Unknown');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_PRESET');
  });

  it('returns 502 when GitHub fetch fails', async () => {
    vi.mocked(listDatSources).mockRejectedValue(new Error('GitHub API returned 403'));
    const res = await app.request('/api/dat-sources');
    expect(res.status).toBe(502);
  });
});

describe('POST /api/dats/from-fresh1g1r', () => {
  it('returns 400 for missing fields', async () => {
    const res = await app.request('/api/dats/from-fresh1g1r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid preset', async () => {
    const res = await app.request('/api/dats/from-fresh1g1r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: 'BadPreset', path: 'a/b.dat', sha: 'abc' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed sha (not 40-hex)', async () => {
    const res = await app.request('/api/dats/from-fresh1g1r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: 'PropeR', path: 'a/b.dat', sha: '../../../evil' }),
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(fetchDat)).not.toHaveBeenCalled();
  });

  it('returns 201 with DAT summary on success', async () => {
    vi.mocked(fetchDat).mockResolvedValue(MOCK_SUMMARY);
    const res = await app.request('/api/dats/from-fresh1g1r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: 'PropeR', path: 'PropeR/test.dat', sha: VALID_SHA }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { system: string; gameCount: number };
    expect(body.system).toBe('Nintendo - Super Nintendo Entertainment System');
    expect(body.gameCount).toBe(42);
  });

  it('returns 502 when the download fails', async () => {
    vi.mocked(fetchDat).mockRejectedValue(new Error('HTTP 404'));
    const res = await app.request('/api/dats/from-fresh1g1r', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: 'PropeR', path: 'PropeR/missing.dat', sha: VALID_SHA }),
    });
    expect(res.status).toBe(502);
  });
});
