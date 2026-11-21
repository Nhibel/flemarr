import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRoute } from '../routes/scan.js';
import { addDat } from '../services/dat/index.js';
import { updateSettings } from '../services/settings/index.js';
import type { DatFile } from '@shared/dat.js';

const app = new Hono().route('/api', scanRoute);

const ROOT = join(tmpdir(), 'flemarr-scan-route-test');

const FIXTURE_DAT: DatFile = {
  source: 'no-intro',
  system: 'Test',
  games: [
    {
      id: 'g1',
      name: 'Test Game (USA)',
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [{ name: 'Test Game (USA).rom', size: 1024, crc: 'aabbccdd', status: 'good' }],
    },
  ],
};

beforeEach(async () => {
  await mkdir(ROOT, { recursive: true });
  updateSettings({ systemPaths: { test: ROOT } });
});

afterEach(async () => {
  updateSettings({ systemPaths: { test: '' } });
  await rm(ROOT, { recursive: true, force: true });
});

describe('POST /api/scan', () => {
  it('returns 400 for missing body fields', async () => {
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the directory is outside every configured root', async () => {
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: 'whatever', directory: join(tmpdir(), 'elsewhere') }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe('PATH_TRAVERSAL');
  });

  it('returns 400 when no system paths are configured', async () => {
    updateSettings({ systemPaths: { test: '' } });
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: 'whatever', directory: ROOT }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe('NO_ROOTS_CONFIGURED');
  });

  it('returns 404 when datId does not exist', async () => {
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: 'nonexistent', directory: ROOT }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 202 with jobId for a valid request', async () => {
    const { id } = addDat(FIXTURE_DAT);
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: id, directory: ROOT }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { jobId?: string };
    expect(typeof body.jobId).toBe('string');
  });
});

describe('POST /api/scan/rename', () => {
  it('returns 400 for missing body fields', async () => {
    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a rename path is outside every configured root', async () => {
    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renames: [{ from: join(tmpdir(), 'elsewhere', 'game.sfc'), to: 'renamed.sfc' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe('PATH_TRAVERSAL');
  });

  it('returns 400 when a destination escapes the root via ..', async () => {
    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renames: [{ from: join(ROOT, 'game.sfc'), to: join('..', '..', 'etc', 'passwd') }],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe('PATH_TRAVERSAL');
  });

  it('returns 409 when a destination file already exists', async () => {
    await writeFile(join(ROOT, 'wrong-name.sfc'), 'a');
    await writeFile(join(ROOT, 'Canonical.sfc'), 'b');

    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renames: [{ from: join(ROOT, 'wrong-name.sfc'), to: 'Canonical.sfc' }],
      }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe('DESTINATION_COLLISION');
  });

  it('returns 409 when two renames target the same destination', async () => {
    await writeFile(join(ROOT, 'a.sfc'), 'a');
    await writeFile(join(ROOT, 'b.sfc'), 'b');

    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renames: [
          { from: join(ROOT, 'a.sfc'), to: 'Same.sfc' },
          { from: join(ROOT, 'b.sfc'), to: 'Same.sfc' },
        ],
      }),
    });
    expect(res.status).toBe(409);
  });

  it('renames a file inside a configured root', async () => {
    await writeFile(join(ROOT, 'wrong-name.sfc'), 'content');

    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renames: [{ from: join(ROOT, 'wrong-name.sfc'), to: 'Canonical.sfc' }],
      }),
    });
    expect(res.status).toBe(200);
    const files = await readdir(ROOT);
    expect(files).toContain('Canonical.sfc');
    expect(files).not.toContain('wrong-name.sfc');
  });

  it('returns the uniform error envelope when a rename fails on disk', async () => {
    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renames: [{ from: join(ROOT, 'does-not-exist.sfc'), to: 'Canonical.sfc' }],
      }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      error?: { code: string; message: string; details?: { rolledBack: string[] } };
    };
    expect(body.error?.code).toBe('RENAME_FAILED');
    expect(body.error?.message).toContain('does-not-exist.sfc');
    expect(body.error?.details?.rolledBack).toEqual([]);
  });

  it('rolls back already-renamed files when a later rename fails', async () => {
    await writeFile(join(ROOT, 'a.sfc'), 'a');

    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renames: [
          { from: join(ROOT, 'a.sfc'), to: 'A-renamed.sfc' },
          { from: join(ROOT, 'missing.sfc'), to: 'B-renamed.sfc' },
        ],
      }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: { details?: { rolledBack: string[] } } };
    expect(body.error?.details?.rolledBack).toEqual([join(ROOT, 'a.sfc')]);

    const files = await readdir(ROOT);
    expect(files).toContain('a.sfc'); // restored
    expect(files).not.toContain('A-renamed.sfc');
  });
});
