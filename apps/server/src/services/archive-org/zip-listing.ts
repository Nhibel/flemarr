import { archiveFetch } from './fetch.js';
import { resolveZipListingUrl } from './metadata.js';
import { logger } from '@/lib/logger.js';

const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  entries: string[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// view_archive lists inner files as <a href="…/zip/<inner>">inner name</a>.
const ENTRY_RE = /<a href="\/\/[^"]+\.zip\/[^"]+">([^<]+)<\/a>/g;

export function parseZipListing(html: string): string[] {
  const entries: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = ENTRY_RE.exec(html)) !== null) {
    const name = m[1];
    if (name !== undefined) entries.push(decodeHtmlEntities(name));
  }
  return entries;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

/**
 * Inner entry names of a ZIP inside an archive.org item, via the datanode's
 * view_archive listing. Needed for collections that re-zip each ROM under a
 * different name than the DAT (e.g. ni-roms stores "Game.md" as "Game.zip").
 */
export async function getZipListing(
  server: string,
  dir: string,
  zipName: string,
): Promise<string[]> {
  const url = resolveZipListingUrl(server, dir, zipName);
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.entries;

  const start = Date.now();
  const res = await archiveFetch(url);
  if (!res.ok) {
    logger.warn({ zipName, status: res.status }, 'zip listing fetch failed');
    throw new Error(`zip listing fetch failed: ${res.status} for ${zipName}`);
  }
  const entries = parseZipListing(await res.text());
  logger.info({ zipName, entries: entries.length, ms: Date.now() - start }, 'zip listing fetched');

  cache.set(url, { entries, expiresAt: Date.now() + TTL_MS });
  return entries;
}
