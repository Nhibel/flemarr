import { logger } from '@/lib/logger.js';

const TTL_OK_MS = 60 * 60 * 1000;
const TTL_BAD_MS = 15 * 60 * 1000;

const cache = new Map<string, { ok: boolean; expiresAt: number }>();

/**
 * Cheap existence check for a candidate download URL (zip-entry URLs can
 * point at a ZIP that doesn't contain the ROM — archive.org answers 404).
 */
export async function urlExists(url: string): Promise<boolean> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.ok;

  let ok = false;
  let status: number | string = 'network-error';
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    // Some mirrors reject HEAD outright — give the download a chance to decide
    ok = res.ok || res.status === 405;
  } catch {
    ok = false;
  }

  logger.debug({ url, status, ok }, 'HEAD check');
  cache.set(url, { ok, expiresAt: Date.now() + (ok ? TTL_OK_MS : TTL_BAD_MS) });
  return ok;
}

export function clearUrlCheckCache(): void {
  cache.clear();
}
