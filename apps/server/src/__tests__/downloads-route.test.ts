import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Hono } from 'hono';
import { downloadsRoute } from '../routes/downloads.js';
import { downloadJobs } from '../services/downloader/index.js';

vi.mock('../services/downloader/index.js', () => ({
  startDownload: vi.fn(),
  cancelJob: vi.fn(),
  findBrowserFile: vi.fn(),
  downloadJobs: new Map(),
}));

import { startDownload, cancelJob, findBrowserFile } from '../services/downloader/index.js';

const app = new Hono().route('/api', downloadsRoute);

const VALID_BODY = {
  datId: 'dat-001',
  items: [
    {
      gameId: 'smw',
      romName: 'Super Mario World (USA).sfc',
      expectedCrc: 'b19ed489',
      downloadUrls: ['https://archive.org/download/test/game.sfc'],
    },
  ],
  destinationDir: '/roms/snes',
};

beforeEach(() => {
  vi.mocked(startDownload).mockReset();
  vi.mocked(cancelJob).mockReset();
  vi.mocked(findBrowserFile).mockReset();
  downloadJobs.clear();
});

describe('POST /api/downloads', () => {
  it('returns 400 for missing body fields', async () => {
    const res = await app.request('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when items array is empty', async () => {
    const res = await app.request('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, items: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 202 with jobId on success', async () => {
    vi.mocked(startDownload).mockResolvedValue('job-123');
    const res = await app.request('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { jobId: string };
    expect(body.jobId).toBe('job-123');
  });

  it('returns 500 when startDownload throws', async () => {
    vi.mocked(startDownload).mockRejectedValue(new Error('fs error'));
    const res = await app.request('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/downloads/:jobId/cancel', () => {
  it('returns 404 when job does not exist', async () => {
    vi.mocked(cancelJob).mockResolvedValue(false);
    const res = await app.request('/api/downloads/nonexistent/cancel', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('returns 200 when job is cancelled', async () => {
    vi.mocked(cancelJob).mockResolvedValue(true);
    const res = await app.request('/api/downloads/job-123/cancel', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe('GET /api/downloads/:jobId/events', () => {
  it('streams error event for unknown job', async () => {
    const res = await app.request('/api/downloads/unknown-job/events');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('not found');
  });

  it('streams buffered events from a known job', async () => {
    downloadJobs.set('job-456', {
      status: 'done',
      target: 'server',
      items: [],
      events: [{ type: 'complete' }],
      controller: new AbortController(),
    });

    const res = await app.request('/api/downloads/job-456/events');
    const text = await res.text();
    expect(text).toContain('complete');
  });
});

describe('GET /api/downloads/:jobId/items/:gameId/:romName', () => {
  const stagedPath = join(tmpdir(), 'rom-curator-route-test.sfc');

  afterEach(async () => {
    await rm(stagedPath, { force: true });
  });

  it('returns 404 when the file is not ready', async () => {
    vi.mocked(findBrowserFile).mockReturnValue(null);
    const res = await app.request('/api/downloads/job-456/items/smw/Super%20Mario.sfc');
    expect(res.status).toBe(404);
  });

  it('streams the staged file with a Content-Disposition header', async () => {
    await writeFile(stagedPath, 'rom-bytes');
    vi.mocked(findBrowserFile).mockReturnValue({
      path: stagedPath,
      filename: 'Super Mario World (USA).sfc',
    });

    const res = await app.request('/api/downloads/job-456/items/smw/ignored.sfc');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('Super Mario World (USA).sfc');
    expect(await res.text()).toBe('rom-bytes');
  });
});
