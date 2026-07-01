import { z } from 'zod';
import type { ArchiveFile } from '@shared/archive.js';

const METADATA_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  files: ArchiveFile[];
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
});

export async function getIndex(identifier: string): Promise<ArchiveFile[]> {
  const cached = cache.get(identifier);
  if (cached && cached.expiresAt > Date.now()) return cached.files;

  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`archive.org metadata fetch failed: ${res.status} for ${identifier}`);
  }

  const raw: unknown = await res.json();
  const parsed = archiveOrgMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Unexpected metadata shape for ${identifier}`);
  }

  const files: ArchiveFile[] = parsed.data.files.map((f) => ({
    name: f.name,
    size: f.size ?? 0,
    crc32: f.crc32,
    format: f.format,
  }));

  cache.set(identifier, { files, expiresAt: Date.now() + METADATA_TTL_MS });
  return files;
}

export function resolveDownloadUrl(identifier: string, fileName: string, zipName?: string): string {
  const base = `https://archive.org/download/${encodeURIComponent(identifier)}`;
  if (zipName) {
    // Pattern B — file inside a ZIP
    return `${base}/${encodeURIComponent(zipName)}/${encodeURIComponent(fileName)}`;
  }
  // Pattern A — direct file
  return `${base}/${encodeURIComponent(fileName)}`;
}

export function clearCache(identifier?: string): void {
  if (identifier) cache.delete(identifier);
  else cache.clear();
}
