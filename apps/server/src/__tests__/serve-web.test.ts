import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { serveWeb } from '../lib/serve-web.js';

const INDEX_HTML = '<!doctype html><title>Flemarr</title><div id="root"></div>';
const APP_JS = 'console.log("hello");';

let webRoot: string;
let app: Hono;

beforeAll(() => {
  webRoot = mkdtempSync(join(tmpdir(), 'serve-web-test-'));
  writeFileSync(join(webRoot, 'index.html'), INDEX_HTML);
  mkdirSync(join(webRoot, 'assets'));
  writeFileSync(join(webRoot, 'assets', 'app.js'), APP_JS);

  app = new Hono();
  // A representative API route mounted before the static handler, as in app.ts.
  app.get('/api/health', (c) => c.json({ status: 'ok' }));
  serveWeb(app, webRoot);
});

afterAll(() => {
  rmSync(webRoot, { recursive: true, force: true });
});

describe('serveWeb', () => {
  it('serves index.html at the root', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe(INDEX_HTML);
  });

  it('serves a real static asset with its own content type', async () => {
    const res = await app.request('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).toBe(APP_JS);
  });

  it('falls back to index.html for an unknown client route (SPA deep link)', async () => {
    const res = await app.request('/games/some-system');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX_HTML);
  });

  it('lets a matched API route win over the static handler', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('does not serve index.html for an unknown /api route (404, not SPA)', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('<div id="root">');
  });

  it('rejects path traversal', async () => {
    const res = await app.request('/../package.json');
    // Traversal is refused by serveStatic; the SPA fallback returns index.html.
    expect(await res.text()).not.toContain('"name"');
  });
});
