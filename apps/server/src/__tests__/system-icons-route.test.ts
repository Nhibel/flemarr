import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { systemIconsRoute } from '../routes/system-icons.js';

// The index normally comes from GitHub and is then cached on disk. Both are
// stubbed: these tests are about the route, and must not touch the network
// or the data directory.
vi.mock('../services/system-icon/index.js', () => ({
  getSystemIcons: vi.fn(),
  systemIconUrl: vi.fn(),
}));

import { getSystemIcons, systemIconUrl } from '../services/system-icon/index.js';

function makeApp() {
  const app = new Hono();
  app.route('/api', systemIconsRoute);
  return app;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.mocked(getSystemIcons).mockReset();
  vi.mocked(systemIconUrl).mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('POST /api/systems/icons', () => {
  it('answers with one entry per system asked for', async () => {
    vi.mocked(getSystemIcons).mockResolvedValue([
      { system: 'Sony - PlayStation', style: 'systematic' },
      { system: 'Video CD', style: null },
    ]);

    const res = await makeApp().request('/api/systems/icons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systems: ['Sony - PlayStation', 'Video CD'] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      icons: [
        { system: 'Sony - PlayStation', style: 'systematic' },
        { system: 'Video CD', style: null },
      ],
    });
  });

  it('rejects an empty list', async () => {
    const res = await makeApp().request('/api/systems/icons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systems: [] }),
    });
    expect(res.status).toBe(400);
    expect(getSystemIcons).not.toHaveBeenCalled();
  });

  it('reports a provider failure as a 502, not a 500', async () => {
    vi.mocked(getSystemIcons).mockRejectedValue(new Error('GitHub API returned 503'));
    const res = await makeApp().request('/api/systems/icons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systems: ['Sony - PlayStation'] }),
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'PROVIDER_ERROR' } });
  });
});

describe('GET /api/systems/icon', () => {
  it('streams the bytes the provider URL serves', async () => {
    vi.mocked(systemIconUrl).mockResolvedValue('https://example.invalid/icon.png');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await makeApp().request('/api/systems/icon?system=Sony%20-%20PlayStation');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    // The commit is pinned upstream, so the bytes are cacheable forever.
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    // The system reaches the resolver decoded, not percent-encoded.
    expect(systemIconUrl).toHaveBeenCalledWith('Sony - PlayStation');
  });

  it('404s when no icon covers the system, without fetching anything', async () => {
    vi.mocked(systemIconUrl).mockResolvedValue(null);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await makeApp().request('/api/systems/icon?system=Video%20CD');

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires the system parameter', async () => {
    const res = await makeApp().request('/api/systems/icon');
    expect(res.status).toBe(400);
    expect(systemIconUrl).not.toHaveBeenCalled();
  });

  it('reports a failing upstream as a 502', async () => {
    vi.mocked(systemIconUrl).mockResolvedValue('https://example.invalid/icon.png');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('nope', { status: 500 })) as unknown as typeof fetch;

    const res = await makeApp().request('/api/systems/icon?system=Sony%20-%20PlayStation');
    expect(res.status).toBe(502);
  });
});
