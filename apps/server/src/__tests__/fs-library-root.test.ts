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
  // The route reads with `withFileTypes`, so the kind comes from the entry
  // itself rather than a stat per name. Two directories and two files, so
  // the counts below are not trivially zero.
  const dirent = (name: string, isDir: boolean) =>
    ({ name, isDirectory: () => isDir }) as unknown as Awaited<ReturnType<typeof readdir>>[number];

  beforeEach(() => {
    vi.mocked(stat).mockResolvedValue(asDir);
    vi.mocked(readdir).mockResolvedValue([
      dirent('snes', true),
      dirent('psx', true),
      dirent('a.sfc', false),
      dirent('b.sfc', false),
    ] as unknown as Awaited<ReturnType<typeof readdir>>);
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

  // The install flow shows this so a folder holding a collection can be
  // recognised without running a scan.
  it('counts the files of the listing and of each child, sub-directories excluded', async () => {
    const res = await app.request('/api/fs/list-dirs');
    const body = (await res.json()) as {
      dirs: { path: string; fileCount: number }[];
      fileCount: number;
    };

    expect(body.fileCount).toBe(2);
    expect(body.dirs.map((d) => d.path)).toEqual([join(ROOT, 'psx'), join(ROOT, 'snes')]);
    // Each child is counted by its own readdir, against the same mock.
    for (const d of body.dirs) expect(d.fileCount).toBe(2);
  });

  it('counts zero for a directory it cannot read, without failing the listing', async () => {
    vi.mocked(readdir)
      .mockResolvedValueOnce([dirent('snes', true)] as unknown as Awaited<
        ReturnType<typeof readdir>
      >)
      .mockRejectedValueOnce(new Error('EACCES'));

    const res = await app.request('/api/fs/list-dirs');
    const body = (await res.json()) as { dirs: { fileCount: number }[]; fileCount: number };

    expect(res.status).toBe(200);
    expect(body.dirs).toHaveLength(1);
    expect(body.dirs[0]?.fileCount).toBe(0);
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
