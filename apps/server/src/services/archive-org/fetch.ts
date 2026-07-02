import { getSettings } from '@/services/settings/index.js';

/**
 * archive.org S3-like API credentials (archive.org/account/s3.php).
 * When configured, they unlock metadata/HEAD/download access to
 * access-restricted items — the same mechanism the official `ia` CLI uses.
 */
export function hasArchiveCredentials(): boolean {
  const { archiveOrgAccessKey, archiveOrgSecretKey } = getSettings();
  return archiveOrgAccessKey !== '' && archiveOrgSecretKey !== '';
}

export function archiveAuthHeaders(): Record<string, string> {
  const { archiveOrgAccessKey, archiveOrgSecretKey } = getSettings();
  if (!archiveOrgAccessKey || !archiveOrgSecretKey) return {};
  return { Authorization: `LOW ${archiveOrgAccessKey}:${archiveOrgSecretKey}` };
}

/** fetch() with the archive.org auth header when credentials are configured. */
export function archiveFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...archiveAuthHeaders(), ...(init?.headers ?? {}) },
  });
}
