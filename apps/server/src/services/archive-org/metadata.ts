import { z } from 'zod';
import type { ArchiveFile } from '@shared/archive.js';
import { archiveFetch } from './fetch.js';
import { logger } from '@/lib/logger.js';

const METADATA_TTL_MS = 24 * 60 * 60 * 1000;

export interface ArchiveItemInfo {
  files: ArchiveFile[];
  /** Item requires login to download — unusable for anonymous per-file fetches */
  restricted: boolean;
}

interface CacheEntry {
  info: ArchiveItemInfo;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

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
});

export async function getItemInfo(identifier: string): Promise<ArchiveItemInfo> {
  const cached = cache.get(identifier);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug({ identifier, fileCount: cached.info.files.length }, 'metadata cache hit');
    return cached.info;
  }

  const start = Date.now();
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const res = await archiveFetch(url);
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

export function clearCache(identifier?: string): void {
  if (identifier) cache.delete(identifier);
  else cache.clear();
}
