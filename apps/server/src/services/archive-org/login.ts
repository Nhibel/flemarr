import { loggedFetch } from '@/lib/logged-fetch.js';
import { z } from 'zod';
import { updateSettings } from '@/services/settings/index.js';
import { clearUrlCheckCache } from './url-check.js';
import { clearResolverCache } from './resolver.js';
import { logger } from '@/lib/logger.js';

// Same exchange as the official `ia configure`: email+password are sent once
// to xauthn and traded for the S3 keys and the session cookies. The password
// is never stored or logged.
const xauthnResponseSchema = z.object({
  success: z.boolean(),
  values: z
    .object({
      reason: z.string().optional(),
      s3: z.object({ access: z.string(), secret: z.string() }).optional(),
      cookies: z
        .object({
          'logged-in-user': z.string().optional(),
          'logged-in-sig': z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// xauthn returns Set-Cookie-style strings ("value; expires=…; path=/") —
// only the value belongs in a Cookie request header.
function cookieValue(raw: string): string {
  return raw.split(';')[0]?.trim() ?? '';
}

export class ArchiveLoginError extends Error {
  constructor(reason: string) {
    super(`archive.org login failed: ${reason}`);
    this.name = 'ArchiveLoginError';
  }
}

export async function exchangeArchiveLogin(email: string, password: string): Promise<void> {
  const res = await loggedFetch('https://archive.org/services/xauthn/?op=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }).toString(),
  });
  if (!res.ok && res.status !== 401) {
    throw new Error(`xauthn returned HTTP ${res.status}`);
  }

  const raw: unknown = await res.json();
  const parsed = xauthnResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Unexpected xauthn response shape');

  if (!parsed.data.success) {
    logger.warn({ reason: parsed.data.values?.reason }, 'archive.org login refused');
    throw new ArchiveLoginError(parsed.data.values?.reason ?? 'unknown');
  }

  const s3 = parsed.data.values?.s3;
  const cookies = parsed.data.values?.cookies;
  updateSettings({
    ...(s3 ? { archiveOrgAccessKey: s3.access, archiveOrgSecretKey: s3.secret } : {}),
    archiveOrgLoggedInUser: cookieValue(cookies?.['logged-in-user'] ?? ''),
    archiveOrgLoggedInSig: cookieValue(cookies?.['logged-in-sig'] ?? ''),
  });

  // Earlier anonymous probes may have cached 403s — start fresh.
  clearUrlCheckCache();
  clearResolverCache();
  logger.info('archive.org login succeeded, credentials stored');
}
