import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { fsRoute } from '../routes/fs.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, stat: vi.fn() };
});

import { stat } from 'node:fs/promises';

const app = new Hono().route('/api', fsRoute);

afterEach(() => {
  vi.mocked(stat).mockReset();
});

describe('POST /api/fs/validate-dir', () => {
  it('returns exists:true isDirectory:true for a real directory', async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as Awaited<
      ReturnType<typeof stat>
    >);
    const res = await app.request('/api/fs/validate-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/roms/snes' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { exists: boolean; isDirectory: boolean };
    expect(body).toEqual({ exists: true, isDirectory: true });
  });

  it('returns exists:true isDirectory:false for a file path', async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as Awaited<
      ReturnType<typeof stat>
    >);
    const res = await app.request('/api/fs/validate-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/roms/game.zip' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { exists: boolean; isDirectory: boolean };
    expect(body).toEqual({ exists: true, isDirectory: false });
  });

  it('returns exists:false when path does not exist', async () => {
    vi.mocked(stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const res = await app.request('/api/fs/validate-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/does/not/exist' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { exists: boolean };
    expect(body.exists).toBe(false);
  });

  it('returns exists:false for a relative path without calling stat', async () => {
    const res = await app.request('/api/fs/validate-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'relative/path' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { exists: boolean };
    expect(body.exists).toBe(false);
    expect(vi.mocked(stat)).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/api/fs/validate-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing path field', async () => {
    const res = await app.request('/api/fs/validate-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
