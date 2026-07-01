import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { healthRoute } from '../routes/health.js';
import { datsRoute } from '../routes/dats.js';

// Fresh app per test to avoid store state pollution
function makeApp() {
  const app = new Hono();
  app.route('/api', healthRoute);
  app.route('/api', datsRoute);
  return app;
}

const VALID_DAT = `<?xml version="1.0"?>
<datafile>
  <header>
    <name>Test System</name>
    <url>https://www.no-intro.org</url>
  </header>
  <game name="Test Game (USA)">
    <description>Test Game (USA)</description>
    <rom name="Test Game (USA).rom" size="1024" crc="aabbccdd" md5="aabbccddaabbccddaabbccddaabbccdd" sha1="aabbccddaabbccddaabbccddaabbccddaabbccdd"/>
  </game>
</datafile>`;

describe('POST /api/dats', () => {
  it('accepts a valid DAT and returns 201 with summary', async () => {
    const app = makeApp();
    const res = await app.request('/api/dats', {
      method: 'POST',
      headers: { 'content-type': 'text/xml' },
      body: VALID_DAT,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      system: string;
      gameCount: number;
      source: string;
    };
    expect(body.system).toBe('Test System');
    expect(body.gameCount).toBe(1);
    expect(body.source).toBe('no-intro');
    expect(typeof body.id).toBe('string');
  });

  it('returns 400 for empty body', async () => {
    const app = makeApp();
    const res = await app.request('/api/dats', {
      method: 'POST',
      headers: { 'content-type': 'text/xml' },
      body: '',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed XML', async () => {
    const app = makeApp();
    const res = await app.request('/api/dats', {
      method: 'POST',
      headers: { 'content-type': 'text/xml' },
      body: '<broken xml',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/dats/:id/games', () => {
  it('returns games for a known DAT id', async () => {
    const app = makeApp();
    // First upload
    const post = await app.request('/api/dats', {
      method: 'POST',
      headers: { 'content-type': 'text/xml' },
      body: VALID_DAT,
    });
    const { id } = (await post.json()) as { id: string };

    // Then fetch games
    const get = await app.request(`/api/dats/${id}/games`);
    expect(get.status).toBe(200);
    const body = (await get.json()) as { games: unknown[] };
    expect(body.games).toHaveLength(1);
  });

  it('returns 404 for unknown id', async () => {
    const app = makeApp();
    const res = await app.request('/api/dats/nonexistent-id/games');
    expect(res.status).toBe(404);
  });
});
