import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { settingsRoute } from '../routes/settings.js';

// Keep the real toSettingsResponse (pure, no db) so the route strips
// credentials as it does in production; only stub the db-backed readers.
vi.mock('../services/settings/index.js', async (importActual) => {
  const actual = await importActual<typeof import('../services/settings/index.js')>();
  return {
    ...actual,
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  };
});

import { getSettings, updateSettings } from '../services/settings/index.js';
import type { Settings, SettingsResponse } from '@shared/settings.js';

const app = new Hono().route('/api', settingsRoute);

const DEFAULT_SETTINGS: Settings = {
  fresh1g1rPreset: 'PropeR',
  downloaderConcurrency: 2,
  systemPaths: {},
  archiveOrgAccessKey: '',
  archiveOrgSecretKey: '',
  archiveOrgLoggedInUser: '',
  archiveOrgLoggedInSig: '',
  downloadTarget: 'server',
  autoConvertChd: false,
};

// What the route exposes: credentials collapsed to configured/not-configured.
const DEFAULT_RESPONSE: SettingsResponse = {
  fresh1g1rPreset: 'PropeR',
  downloaderConcurrency: 2,
  systemPaths: {},
  archiveOrgKeysConfigured: false,
  archiveOrgSessionConfigured: false,
  downloadTarget: 'server',
  autoConvertChd: false,
  romsRoot: null,
};

beforeEach(() => {
  vi.mocked(getSettings).mockReset();
  vi.mocked(updateSettings).mockReset();
});

describe('GET /api/settings', () => {
  it('returns current settings without exposing credentials', async () => {
    vi.mocked(getSettings).mockReturnValue({
      ...DEFAULT_SETTINGS,
      archiveOrgAccessKey: 'secret-access',
      archiveOrgSecretKey: 'secret-secret',
    });
    const res = await app.request('/api/settings');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // The response reports the keys as configured but never returns their values.
    expect(body).toEqual({ ...DEFAULT_RESPONSE, archiveOrgKeysConfigured: true });
    expect(JSON.stringify(body)).not.toContain('secret-access');
    expect(JSON.stringify(body)).not.toContain('secret-secret');
  });
});

describe('PATCH /api/settings', () => {
  it('updates fresh1g1rPreset and returns updated settings', async () => {
    const updated: Settings = { ...DEFAULT_SETTINGS, fresh1g1rPreset: 'McLean' };
    vi.mocked(updateSettings).mockReturnValue(updated);
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fresh1g1rPreset: 'McLean' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ fresh1g1rPreset: 'McLean' });
    expect(vi.mocked(updateSettings)).toHaveBeenCalledWith({ fresh1g1rPreset: 'McLean' });
  });

  it('updates downloaderConcurrency', async () => {
    const updated = { ...DEFAULT_SETTINGS, downloaderConcurrency: 4 };
    vi.mocked(updateSettings).mockReturnValue(updated);
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloaderConcurrency: 4 }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(updateSettings)).toHaveBeenCalledWith({ downloaderConcurrency: 4 });
  });

  it('updates a system path', async () => {
    const updated = { ...DEFAULT_SETTINGS, systemPaths: { 'Nintendo - SNES': '/roms/snes' } };
    vi.mocked(updateSettings).mockReturnValue(updated);
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPaths: { 'Nintendo - SNES': '/roms/snes' } }),
    });
    expect(res.status).toBe(200);
  });

  it('updates downloadTarget', async () => {
    const updated = { ...DEFAULT_SETTINGS, downloadTarget: 'browser' as const };
    vi.mocked(updateSettings).mockReturnValue(updated);
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadTarget: 'browser' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { downloadTarget: string };
    expect(body.downloadTarget).toBe('browser');
    expect(vi.mocked(updateSettings)).toHaveBeenCalledWith({ downloadTarget: 'browser' });
  });

  it('returns 400 for an unknown downloadTarget', async () => {
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadTarget: 'cloud' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid preset', async () => {
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fresh1g1rPreset: 'BadPreset' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for concurrency out of range', async () => {
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloaderConcurrency: 99 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_JSON');
  });
});
