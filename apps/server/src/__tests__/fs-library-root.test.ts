import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { join, dirname } from 'node:path';
import { fsRoute } from '../routes/fs.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, stat: vi.fn(), readdir: vi.fn(), mkdir: vi.fn() };
});

import { stat, readdir, mkdir } from 'node:fs/promises';

const app = new Hono().route('/api', fsRoute);
const ROOT = join(process.cwd(), 'test-library-root');

const asDir = { isDirectory: () => true } as Awaited<ReturnType<typeof stat>>;

beforeEach(() => {
  process.env['ROMS_ROOT'] = ROOT;
  vi.mocked(stat).mockReset();
  vi.mocked(readdir).mockReset();
  vi.mocked(mkdir).mockReset();
});

afterEach(() => {
  delete process.env['ROMS_ROOT'];
});

describe('GET /api/fs/list-dirs confined to ROMS_ROOT', () => {
  beforeEach(() => {
    vi.mocked(stat).mockResolvedValue(asDir);
    vi.mocked(readdir).mockResolvedValue(['snes', 'psx'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
  });

  it('starts at the root and hides the parent when no path is given', async () => {
    const res = await app.request('/api/fs/list-dirs');
    const body = (await res.json()) as { listedPath: string; parent: string | null };
    expect(body.listedPath).toBe(ROOT);
    expect(body.parent).toBeNull();
  });

  it('clamps a path outside the root back to the root', async () => {
    const res = await app.request(`/api/fs/list-dirs?path=${encodeURIComponent('/etc')}`);
    const body = (await res.json()) as { listedPath: string; parent: string | null };
    expect(body.listedPath).toBe(ROOT);
    expect(body.parent).toBeNull();
  });

  it('browses a subfolder and exposes the root as its parent', async () => {
    const sub = join(ROOT, 'snes');
    const res = await app.request(`/api/fs/list-dirs?path=${encodeURIComponent(sub)}`);
    const body = (await res.json()) as { listedPath: string; parent: string | null };
    expect(body.listedPath).toBe(sub);
    expect(body.parent).toBe(ROOT);
  });
});

describe('POST /api/fs/create-dir', () => {
  it('creates a directory inside the root', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    const target = join(ROOT, 'gba');
    const res = await app.request('/api/fs/create-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()) as { path: string }).toEqual({ path: target });
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(target, { recursive: true });
  });

  it('refuses a path outside the root and does not create anything', async () => {
    const res = await app.request('/api/fs/create-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: join(dirname(ROOT), 'evil') }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('PATH_TRAVERSAL');
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('rejects a relative path', async () => {
    const res = await app.request('/api/fs/create-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'relative/dir' }),
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('reports NO_ROOTS_CONFIGURED when neither ROMS_ROOT nor system paths are set', async () => {
    delete process.env['ROMS_ROOT'];
    const res = await app.request('/api/fs/create-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/anywhere/sub' }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'NO_ROOTS_CONFIGURED',
    );
  });
});
