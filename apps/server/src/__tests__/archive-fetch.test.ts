import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  archiveFetch,
  archiveAuthHeaders,
  hasArchiveCredentials,
} from '../services/archive-org/fetch.js';
import { updateSettings } from '../services/settings/index.js';

function clearKeys() {
  updateSettings({ archiveOrgAccessKey: '', archiveOrgSecretKey: '' });
}

beforeEach(clearKeys);
afterEach(() => {
  clearKeys();
  vi.unstubAllGlobals();
});

describe('archive.org credentials', () => {
  it('reports no credentials by default', () => {
    expect(hasArchiveCredentials()).toBe(false);
    expect(archiveAuthHeaders()).toEqual({});
  });

  it('builds the LOW authorization header from settings', () => {
    updateSettings({ archiveOrgAccessKey: 'myAccess', archiveOrgSecretKey: 'mySecret' });
    expect(hasArchiveCredentials()).toBe(true);
    expect(archiveAuthHeaders()).toEqual({ Authorization: 'LOW myAccess:mySecret' });
  });

  it('requires both keys — a single one is not enough', () => {
    updateSettings({ archiveOrgAccessKey: 'myAccess' });
    expect(hasArchiveCredentials()).toBe(false);
    expect(archiveAuthHeaders()).toEqual({});
  });
});

describe('archiveFetch', () => {
  it('adds the auth header when credentials are configured', async () => {
    updateSettings({ archiveOrgAccessKey: 'ak', archiveOrgSecretKey: 'sk' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await archiveFetch('https://archive.org/metadata/x', { method: 'HEAD' });

    expect(fetchMock).toHaveBeenCalledWith('https://archive.org/metadata/x', {
      method: 'HEAD',
      headers: { Authorization: 'LOW ak:sk' },
    });
  });

  it('sends no auth header without credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await archiveFetch('https://archive.org/metadata/x');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({});
  });
});
