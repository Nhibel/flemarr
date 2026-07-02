import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  archiveFetch,
  archiveAuthHeaders,
  hasArchiveCredentials,
} from '../services/archive-org/fetch.js';
import { updateSettings } from '../services/settings/index.js';

function clearKeys() {
  updateSettings({
    archiveOrgAccessKey: '',
    archiveOrgSecretKey: '',
    archiveOrgLoggedInUser: '',
    archiveOrgLoggedInSig: '',
  });
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

  it('sends the session cookies when configured (login exchange)', () => {
    updateSettings({ archiveOrgLoggedInUser: 'user%40mail.com', archiveOrgLoggedInSig: 'sig123' });
    expect(hasArchiveCredentials()).toBe(true);
    expect(archiveAuthHeaders()).toEqual({
      Cookie: 'logged-in-user=user%40mail.com; logged-in-sig=sig123',
    });
  });

  it('sends both the S3 header and the cookies when everything is configured', () => {
    updateSettings({
      archiveOrgAccessKey: 'ak',
      archiveOrgSecretKey: 'sk',
      archiveOrgLoggedInUser: 'u',
      archiveOrgLoggedInSig: 's',
    });
    expect(archiveAuthHeaders()).toEqual({
      Authorization: 'LOW ak:sk',
      Cookie: 'logged-in-user=u; logged-in-sig=s',
    });
  });
});

function ok() {
  return { status: 200, headers: { get: () => null } };
}

function redirectTo(location: string) {
  return { status: 302, headers: { get: (h: string) => (h === 'location' ? location : null) } };
}

describe('archiveFetch', () => {
  it('adds the auth header when credentials are configured', async () => {
    updateSettings({ archiveOrgAccessKey: 'ak', archiveOrgSecretKey: 'sk' });
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);

    await archiveFetch('https://archive.org/metadata/x', { method: 'HEAD' });

    expect(fetchMock).toHaveBeenCalledWith('https://archive.org/metadata/x', {
      method: 'HEAD',
      headers: { Authorization: 'LOW ak:sk' },
      redirect: 'manual',
    });
  });

  it('sends no auth header without credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal('fetch', fetchMock);

    await archiveFetch('https://archive.org/metadata/x');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({});
  });

  it('re-attaches the auth header when redirected to an archive.org datanode', async () => {
    updateSettings({ archiveOrgAccessKey: 'ak', archiveOrgSecretKey: 'sk' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo('https://ia803203.us.archive.org/view_archive.php?x=1'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    const res = await archiveFetch('https://archive.org/download/item/file.zip/rom.sfc');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(secondInit.headers).toEqual({ Authorization: 'LOW ak:sk' });
  });

  it('drops the auth header when redirected off archive.org', async () => {
    updateSettings({ archiveOrgAccessKey: 'ak', archiveOrgSecretKey: 'sk' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo('https://mirror.example.com/file'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    await archiveFetch('https://archive.org/download/item/rom.sfc');

    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(secondInit.headers).toEqual({});
  });

  it('gives up after too many redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(redirectTo('https://archive.org/loop'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(archiveFetch('https://archive.org/download/x')).rejects.toThrow(
      'Too many redirects',
    );
  });
});
