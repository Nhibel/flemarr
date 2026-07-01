import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { scanRoute } from '../routes/scan.js';
import { addDat } from '../services/dat/index.js';
import type { DatFile } from '@shared/dat.js';

const app = new Hono().route('/api', scanRoute);

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

  it('returns 404 when datId does not exist', async () => {
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: 'nonexistent', directory: '/tmp' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 202 with jobId for a valid request', async () => {
    const { id } = addDat(FIXTURE_DAT);
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datId: id, directory: '.' }),
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

  it('returns 400 when a rename path is outside the root', async () => {
    const res = await app.request('/api/scan/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        root: '/roms/snes',
        renames: [{ from: '/roms/snes/game.sfc', to: '../../etc/passwd' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe('PATH_TRAVERSAL');
  });
});
