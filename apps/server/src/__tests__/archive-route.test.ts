import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { archiveRoute } from '../routes/archive.js';
import { addDat } from '../services/dat/index.js';
import { removeSource } from '../services/archive-org/sources.js';
import type { DatFile } from '@shared/dat.js';

vi.mock('../services/archive-org/metadata.js', () => ({
  getIndex: vi.fn(),
  resolveDownloadUrl: vi.fn((id: string, file: string, zip?: string) =>
    zip
      ? `https://archive.org/download/${id}/${zip}/${file}`
      : `https://archive.org/download/${id}/${file}`,
  ),
  clearCache: vi.fn(),
}));

vi.mock('../services/archive-org/resolver.js', () => ({
  resolveGames: vi.fn().mockResolvedValue([]),
  clearResolverCache: vi.fn(),
}));

vi.mock('../services/archive-org/suggest.js', () => ({
  suggestSources: vi.fn(),
}));

vi.mock('../services/archive-org/login.js', () => {
  class ArchiveLoginError extends Error {}
  return { exchangeArchiveLogin: vi.fn(), ArchiveLoginError };
});

import { getIndex } from '../services/archive-org/metadata.js';
import { resolveGames, clearResolverCache } from '../services/archive-org/resolver.js';
import { suggestSources } from '../services/archive-org/suggest.js';
import { exchangeArchiveLogin, ArchiveLoginError } from '../services/archive-org/login.js';

const app = new Hono().route('/api', archiveRoute);

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
  ],
};

beforeEach(() => {
  removeSource('test-id', 'Nintendo - Super Nintendo Entertainment System');
  vi.mocked(getIndex).mockReset();
  vi.mocked(resolveGames).mockReset().mockResolvedValue([]);
});

describe('GET /api/archive/sources', () => {
  it('returns empty list for unknown system', async () => {
    const res = await app.request('/api/archive/sources?system=Unknown%20System');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sources: unknown[] };
    expect(body.sources).toEqual([]);
  });

  it('returns added sources for a system', async () => {
    await app.request('/api/archive/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'Nintendo - Super Nintendo Entertainment System',
        source: { identifier: 'test-id', layout: 'direct', note: 'test' },
      }),
    });
    const res = await app.request(
      '/api/archive/sources?system=Nintendo%20-%20Super%20Nintendo%20Entertainment%20System',
    );
    const body = (await res.json()) as { sources: { identifier: string }[] };
    expect(body.sources.some((s) => s.identifier === 'test-id')).toBe(true);
    removeSource('test-id', 'Nintendo - Super Nintendo Entertainment System');
  });
});

describe('POST /api/archive/sources', () => {
  it('returns 400 for missing fields', async () => {
    const res = await app.request('/api/archive/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 201 for a valid source', async () => {
    const res = await app.request('/api/archive/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'Nintendo - Super Nintendo Entertainment System',
        source: { identifier: 'test-id', layout: 'direct', note: '' },
      }),
    });
    expect(res.status).toBe(201);
    removeSource('test-id', 'Nintendo - Super Nintendo Entertainment System');
  });

  it('invalidates the resolver cache when a source is added', async () => {
    vi.mocked(clearResolverCache).mockClear();
    await app.request('/api/archive/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'Nintendo - Super Nintendo Entertainment System',
        source: { identifier: 'test-id', layout: 'direct', note: '' },
      }),
    });
    expect(vi.mocked(clearResolverCache)).toHaveBeenCalled();
    removeSource('test-id', 'Nintendo - Super Nintendo Entertainment System');
  });
});

describe('DELETE /api/archive/sources/:identifier', () => {
  const addTestSource = async (system: string): Promise<Response> =>
    app.request('/api/archive/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system,
        source: { identifier: 'test-id', layout: 'direct', note: '' },
      }),
    });

  it('returns 400 when the system is missing', async () => {
    const res = await app.request('/api/archive/sources/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent source', async () => {
    const res = await app.request(
      '/api/archive/sources/nonexistent?system=Nintendo%20-%20Super%20Nintendo%20Entertainment%20System',
      {
        method: 'DELETE',
      },
    );
    expect(res.status).toBe(404);
  });

  it('removes an existing source', async () => {
    await addTestSource('Nintendo - Super Nintendo Entertainment System');
    const res = await app.request(
      '/api/archive/sources/test-id?system=Nintendo%20-%20Super%20Nintendo%20Entertainment%20System',
      {
        method: 'DELETE',
      },
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 when the source exists under a different system', async () => {
    await addTestSource('Nintendo - Super Nintendo Entertainment System');
    const res = await app.request('/api/archive/sources/test-id?system=Sony%20-%20PlayStation', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
    removeSource('test-id', 'Nintendo - Super Nintendo Entertainment System');
  });

  // A multi-system collection dropped from one system stays on the others.
  it('leaves the same identifier registered for other systems', async () => {
    await addTestSource('Nintendo - Super Nintendo Entertainment System');
    await addTestSource('Sony - PlayStation');
    await app.request(
      '/api/archive/sources/test-id?system=Nintendo%20-%20Super%20Nintendo%20Entertainment%20System',
      { method: 'DELETE' },
    );
    const res = await app.request('/api/archive/sources?system=Sony%20-%20PlayStation');
    const body = (await res.json()) as { sources: { identifier: string }[] };
    expect(body.sources.some((s) => s.identifier === 'test-id')).toBe(true);
    removeSource('test-id', 'Sony - PlayStation');
  });
});

describe('POST /api/archive/index', () => {
  it('returns 400 for missing identifier', async () => {
    const res = await app.request('/api/archive/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 502 when archive.org fetch fails', async () => {
    vi.mocked(getIndex).mockRejectedValue(new Error('network error'));
    const res = await app.request('/api/archive/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'some-id' }),
    });
    expect(res.status).toBe(502);
  });

  it('returns file count and preview on success', async () => {
    vi.mocked(getIndex).mockResolvedValue([{ name: 'game.sfc', size: 1024, crc32: 'aabbccdd' }]);
    const res = await app.request('/api/archive/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'some-id' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fileCount: number; preview: unknown[] };
    expect(body.fileCount).toBe(1);
    expect(body.preview).toHaveLength(1);
  });
});

describe('POST /api/archive/resolve', () => {
  it('returns 400 for missing fields', async () => {
    const res = await app.request('/api/archive/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown datId', async () => {
    const res = await app.request('/api/archive/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: 'nonexistent', gameIds: ['smw'] }),
    });
    expect(res.status).toBe(404);
  });

  it('returns resolve results for a known DAT', async () => {
    const { id } = addDat(FIXTURE_DAT);
    vi.mocked(resolveGames).mockResolvedValue([
      {
        gameId: 'smw',
        gameName: 'Super Mario World (USA)',
        roms: [{ romName: 'Super Mario World (USA).sfc', expectedCrc: 'b19ed489', sources: [] }],
      },
    ]);
    const res = await app.request('/api/archive/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: id, gameIds: ['smw'] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { gameId: string }[] };
    expect(body.results[0]?.gameId).toBe('smw');
  });
});

describe('POST /api/archive/login', () => {
  it('returns 400 for a malformed email', async () => {
    const res = await app.request('/api/archive/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'x' }),
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(exchangeArchiveLogin)).not.toHaveBeenCalled();
  });

  it('returns 200 on successful exchange', async () => {
    vi.mocked(exchangeArchiveLogin).mockResolvedValue(undefined);
    const res = await app.request('/api/archive/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(exchangeArchiveLogin)).toHaveBeenCalledWith('a@b.com', 'pw');
  });

  it('returns 401 when archive.org rejects the credentials', async () => {
    vi.mocked(exchangeArchiveLogin).mockRejectedValue(new ArchiveLoginError('bad password'));
    const res = await app.request('/api/archive/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/archive/suggest', () => {
  it('returns 404 for unknown datId', async () => {
    const res = await app.request('/api/archive/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns ranked suggestions for a known DAT', async () => {
    const { id } = addDat(FIXTURE_DAT);
    vi.mocked(suggestSources).mockResolvedValue([
      {
        identifier: 'good-collection',
        title: 'Good',
        layout: 'direct',
        fileCount: 3000,
        coverage: 0.96,
        crcCoverage: 0.9,
        sampleSize: 50,
      },
    ]);
    const res = await app.request('/api/archive/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { suggestions: { identifier: string; coverage: number }[] };
    expect(body.suggestions[0]?.identifier).toBe('good-collection');
    expect(body.suggestions[0]?.coverage).toBe(0.96);
  });

  it('returns 502 when the suggestion run fails', async () => {
    const { id } = addDat(FIXTURE_DAT);
    vi.mocked(suggestSources).mockRejectedValue(new Error('archive.org search returned 503'));
    const res = await app.request('/api/archive/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: id }),
    });
    expect(res.status).toBe(502);
  });
});
