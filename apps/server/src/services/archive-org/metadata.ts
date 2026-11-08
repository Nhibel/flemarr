import { z } from 'zod';
import type { ArchiveFile } from '@shared/archive.js';
import { archiveFetch } from './fetch.js';
import { logger } from '@/lib/logger.js';

const METADATA_TTL_MS = 24 * 60 * 60 * 1000;

export interface ArchiveItemInfo {
  files: ArchiveFile[];
  /** Item requires login to download — unusable for anonymous per-file fetches */
  restricted: boolean;
  /** Datanode host serving this item (e.g. ia802803.us.archive.org) */
  server: string;
  /** Absolute item path on the datanode (e.g. /17/items/ni-roms) */
  dir: string;
}

interface CacheEntry {
  info: ArchiveItemInfo;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// archive.org signals overload with 429/503 on metadata lookups too, not just
// file downloads (which the downloader worker already retries) — docs/
// archive-org-strategy.md says to honor these; this was the one call site
// that didn't yet.
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT_S = 30;

async function fetchWithRetry(url: string): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await archiveFetch(url);
    if (!RETRYABLE_STATUS.has(res.status) || attempt >= MAX_RETRIES) return res;

    const retryAfter = res.headers.get('retry-after');
    const waitSeconds =
      retryAfter !== null && Number.isFinite(Number(retryAfter))
        ? Math.min(Number(retryAfter), MAX_RETRY_WAIT_S)
        : (attempt + 1) * 5;
    await new Promise((r) => setTimeout(r, waitSeconds * 1000));
    attempt++;
  }
}

// Shape of the files array in archive.org's metadata response
const archiveOrgFileSchema = z.object({
  name: z.string(),
  size: z.coerce.number().optional(),
  crc32: z.string().optional(),
  format: z.string().optional(),
});

const archiveOrgMetadataSchema = z.object({
  files: z.array(archiveOrgFileSchema),
  metadata: z.object({ 'access-restricted-item': z.string().optional() }).optional(),
  server: z.string().optional(),
  dir: z.string().optional(),
});

export async function getItemInfo(identifier: string): Promise<ArchiveItemInfo> {
  const cached = cache.get(identifier);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug({ identifier, fileCount: cached.info.files.length }, 'metadata cache hit');
    return cached.info;
  }

  const start = Date.now();
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    logger.warn({ identifier, status: res.status }, 'metadata fetch failed');
    throw new Error(`archive.org metadata fetch failed: ${res.status} for ${identifier}`);
  }

  const raw: unknown = await res.json();
  const parsed = archiveOrgMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ identifier }, 'unexpected metadata shape');
    throw new Error(`Unexpected metadata shape for ${identifier}`);
  }

  const info: ArchiveItemInfo = {
    files: parsed.data.files.map((f) => ({
      name: f.name,
      size: f.size ?? 0,
      crc32: f.crc32,
      format: f.format,
    })),
    restricted: parsed.data.metadata?.['access-restricted-item'] === 'true',
    server: parsed.data.server ?? '',
    dir: parsed.data.dir ?? '',
  };

  logger.info(
    {
      identifier,
      fileCount: info.files.length,
      restricted: info.restricted,
      ms: Date.now() - start,
    },
    'metadata fetched',
  );
  cache.set(identifier, { info, expiresAt: Date.now() + METADATA_TTL_MS });
  return info;
}

export async function getIndex(identifier: string): Promise<ArchiveFile[]> {
  return (await getItemInfo(identifier)).files;
}

// Encode each path segment separately: file/zip names can live in
// subdirectories and a %2F-encoded slash 404s on archive.org.
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function resolveDownloadUrl(identifier: string, fileName: string, zipName?: string): string {
  const base = `https://archive.org/download/${encodeURIComponent(identifier)}`;
  if (zipName) {
    // Pattern B — file inside a ZIP
    return `${base}/${encodePath(zipName)}/${encodePath(fileName)}`;
  }
  // Pattern A — direct file
  return `${base}/${encodePath(fileName)}`;
}

/**
 * Datanode view_archive URL for extracting one entry from a ZIP. This is the
 * only way to reach restricted/darked items (their /download/ path 403s), and
 * it also serves public items. `server` and `dir` come from getItemInfo.
 */
export function resolveZipViewUrl(
  server: string,
  dir: string,
  zipName: string,
  innerPath: string,
): string {
  const archive = `${dir}/${zipName}`;
  return (
    `https://${server}/view_archive.php` +
    `?archive=${encodeURIComponent(archive)}&file=${encodeURIComponent(innerPath)}`
  );
}

/** view_archive HTML listing URL for a ZIP (enumerates its inner entries). */
export function resolveZipListingUrl(server: string, dir: string, zipName: string): string {
  const archive = `${dir}/${zipName}`;
  return `https://${server}/view_archive.php?archive=${encodeURIComponent(archive)}`;
}

export function clearCache(identifier?: string): void {
  if (identifier) cache.delete(identifier);
  else cache.clear();
}
