import { getSettings } from '@/services/settings/index.js';

/**
 * archive.org S3-like API credentials (archive.org/account/s3.php).
 * When configured, they unlock metadata/HEAD/download access to
 * access-restricted items — the same mechanism the official `ia` CLI uses.
 */
export function hasArchiveCredentials(): boolean {
  const s = getSettings();
  return (
    (s.archiveOrgAccessKey !== '' && s.archiveOrgSecretKey !== '') ||
    (s.archiveOrgLoggedInUser !== '' && s.archiveOrgLoggedInSig !== '')
  );
}

export function archiveAuthHeaders(): Record<string, string> {
  const s = getSettings();
  const headers: Record<string, string> = {};
  if (s.archiveOrgAccessKey && s.archiveOrgSecretKey) {
    headers['Authorization'] = `LOW ${s.archiveOrgAccessKey}:${s.archiveOrgSecretKey}`;
  }
  // The datanodes check the session cookies (not the S3 header) for
  // restricted zip-view downloads — send both when available.
  if (s.archiveOrgLoggedInUser && s.archiveOrgLoggedInSig) {
    headers['Cookie'] =
      `logged-in-user=${s.archiveOrgLoggedInUser}; logged-in-sig=${s.archiveOrgLoggedInSig}`;
  }
  return headers;
}

function isArchiveHost(url: string): boolean {
  const host = new URL(url).hostname;
  return host === 'archive.org' || host.endsWith('.archive.org');
}

const MAX_REDIRECTS = 5;

/**
 * fetch() with the archive.org auth header when credentials are configured.
 *
 * Redirects are followed manually: undici strips the Authorization header on
 * cross-origin redirects, but archive.org/download/* redirects to datanodes
 * (ia80xx.us.archive.org) that *need* it for restricted items — so the header
 * is re-attached as long as the target stays on *.archive.org.
 */
export async function archiveFetch(url: string, init?: RequestInit): Promise<Response> {
  const rest = { ...init };
  delete rest.redirect; // redirects are always handled manually here
  let current = url;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const auth = isArchiveHost(current) ? archiveAuthHeaders() : {};
    const res = await fetch(current, {
      ...rest,
      headers: { ...auth, ...(rest.headers ?? {}) },
      redirect: 'manual',
    });

    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('location');
    if (!location) return res;
    current = new URL(location, current).toString();
  }

  throw new Error(`Too many redirects fetching ${url}`);
}
