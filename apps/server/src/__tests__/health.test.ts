import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { healthRoute } from '../routes/health.js';

const app = new Hono();
app.route('/api', healthRoute);

describe('GET /api/health', () => {
  it('returns { status: "ok" }', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
