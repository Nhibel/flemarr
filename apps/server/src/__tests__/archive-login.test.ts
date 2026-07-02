import { describe, it, expect, vi, afterEach } from 'vitest';
import { exchangeArchiveLogin } from '../services/archive-org/login.js';
import { getSettings, updateSettings } from '../services/settings/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
  updateSettings({
    archiveOrgAccessKey: '',
    archiveOrgSecretKey: '',
    archiveOrgLoggedInUser: '',
    archiveOrgLoggedInSig: '',
  });
});

describe('exchangeArchiveLogin', () => {
  it('stores keys and cookies on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            values: {
              s3: { access: 'the-access', secret: 'the-secret' },
              cookies: { 'logged-in-user': 'me%40mail.com', 'logged-in-sig': 'the-sig' },
            },
            version: 1,
          }),
      }),
    );

    await exchangeArchiveLogin('me@mail.com', 'pw');

    const s = getSettings();
    expect(s.archiveOrgAccessKey).toBe('the-access');
    expect(s.archiveOrgSecretKey).toBe('the-secret');
    expect(s.archiveOrgLoggedInUser).toBe('me%40mail.com');
    expect(s.archiveOrgLoggedInSig).toBe('the-sig');
  });

  it('strips Set-Cookie attributes — only the value goes in a Cookie header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            values: {
              cookies: {
                'logged-in-user':
                  'me%40mail.com; expires=Fri, 03 Jul 2027 00:00:00 GMT; path=/; domain=.archive.org',
                'logged-in-sig': 'sig-value; expires=Fri, 03 Jul 2027 00:00:00 GMT; path=/',
              },
            },
            version: 1,
          }),
      }),
    );

    await exchangeArchiveLogin('me@mail.com', 'pw');

    const s = getSettings();
    expect(s.archiveOrgLoggedInUser).toBe('me%40mail.com');
    expect(s.archiveOrgLoggedInSig).toBe('sig-value');
  });

  it('throws ArchiveLoginError with the reason on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ success: false, values: { reason: 'account_not_found' }, version: 1 }),
      }),
    );

    await expect(exchangeArchiveLogin('x@mail.com', 'bad')).rejects.toThrow('account_not_found');
    expect(getSettings().archiveOrgLoggedInUser).toBe('');
  });

  it('never sends the password anywhere else than xauthn', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: false, values: { reason: 'x' }, version: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await exchangeArchiveLogin('a@b.c', 'secret-pw').catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('archive.org/services/xauthn');
  });
});
