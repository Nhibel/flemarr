import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { datsRoute } from '../routes/dats.js';
import { gameDetailsRoute } from '../routes/game-details.js';

function makeApp() {
  const app = new Hono();
  app.route('/api', datsRoute);
  app.route('/api', gameDetailsRoute);
  return app;
}

// addDat re-uses the dat id for a given system+source, and game ids are
// content hashes — two uploads of the same system share the game_details
// cache. Tests that must not see each other's cache use distinct systems.
function datXml(system: string): string {
  return `<?xml version="1.0"?>
<datafile>
  <header>
    <name>${system}</name>
    <url>https://www.no-intro.org</url>
  </header>
  <game name="Tetris (World) (Rev 1)">
    <description>Tetris (World) (Rev 1)</description>
    <rom name="Tetris (World) (Rev 1).gb" size="32768" crc="aabbccdd"/>
  </game>
  <game name="Unknown Homebrew (World)">
    <description>Unknown Homebrew (World)</description>
    <rom name="Unknown Homebrew (World).gb" size="32768" crc="ddccbbaa"/>
  </game>
</datafile>`;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function uploadDat(
  app: Hono,
  system = 'Nintendo - Game Boy (Retool)',
): Promise<{ datId: string; gameIds: string[] }> {
  const upload = await app.request('/api/dats', { method: 'POST', body: datXml(system) });
  const { id } = (await upload.json()) as { id: string };
  const games = await app.request(`/api/dats/${id}/games`);
  const body = (await games.json()) as { games: Array<{ id: string; name: string }> };
  return { datId: id, gameIds: body.games.map((g) => g.id) };
}

describe('POST /api/dats/:id/games/details', () => {
  it('probes the provider once per game and caches the result', async () => {
    const app = makeApp();
    const { datId, gameIds } = await uploadDat(app);

    // Tetris has a boxart upstream, the homebrew doesn't.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(new Response(null, { status: url.includes('Tetris') ? 200 : 404 })),
    );

    const res = await app.request(`/api/dats/${datId}/games/details`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameIds }),
    });
    expect(res.status).toBe(200);
    const { details } = (await res.json()) as {
      details: Array<{ gameId: string; hasBoxart: boolean }>;
    };
    expect(details).toHaveLength(2);
    const byId = new Map(details.map((d) => [d.gameId, d.hasBoxart]));
    expect(byId.get(gameIds[0] ?? '')).toBe(true);
    expect(byId.get(gameIds[1] ?? '')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second request for the same page: everything from SQLite, no probe.
    const again = await app.request(`/api/dats/${datId}/games/details`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameIds }),
    });
    expect(again.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('404s on an unknown DAT', async () => {
    const app = makeApp();
    const res = await app.request('/api/dats/nope/games/details', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameIds: ['x'] }),
    });
    expect(res.status).toBe(404);
  });

  it('400s on an invalid body', async () => {
    const app = makeApp();
    const { datId } = await uploadDat(app);
    const res = await app.request(`/api/dats/${datId}/games/details`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('omits unknown gameIds instead of failing', async () => {
    const app = makeApp();
    const { datId, gameIds } = await uploadDat(app);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const res = await app.request(`/api/dats/${datId}/games/details`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameIds: [gameIds[0], 'does-not-exist'] }),
    });
    const { details } = (await res.json()) as { details: Array<{ gameId: string }> };
    expect(details).toHaveLength(1);
  });
});

describe('GET /api/dats/:id/games/:gameId/boxart', () => {
  it('streams the cached boxart through the proxy', async () => {
    const app = makeApp();
    const { datId, gameIds } = await uploadDat(app);

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return Promise.resolve(new Response(null, { status: 200 }));
      expect(url).toContain('thumbnails.libretro.com');
      return Promise.resolve(
        new Response('PNGDATA', { status: 200, headers: { 'content-type': 'image/png' } }),
      );
    });

    await app.request(`/api/dats/${datId}/games/details`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameIds: [gameIds[0]] }),
    });

    const res = await app.request(`/api/dats/${datId}/games/${gameIds[0]}/boxart`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(await res.text()).toBe('PNGDATA');
  });

  it('404s when no boxart is cached for the game', async () => {
    const app = makeApp();
    const { datId } = await uploadDat(app);
    const res = await app.request(`/api/dats/${datId}/games/whatever/boxart`);
    expect(res.status).toBe(404);
  });
});
