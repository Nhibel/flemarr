import type { Fresh1g1rPreset, DatSourceEntry } from '@shared/fresh1g1r.js';
import type { DatSummary } from '@shared/dat.js';
import { parseDat, addDat, setDatOrigin } from '@/services/dat/index.js';
import { logger } from '@/lib/logger.js';
import { cacheDat, readCachedDat } from './dat-cache.js';
import { COLLECTIONS, assetName, datPath, locateDat } from './dat-path.js';
import type { Collection } from './dat-path.js';
import { listEntries, readEntry } from './release-asset.js';
import type { ZipEntry } from './zip-index.js';

function systemFromFilename(name: string): string {
  // Strip "(No-Intro - Fresh1G1R - PropeR).dat" / "(Redump - Fresh1G1R - PropeR).dat" suffix
  return name.replace(/\s+\([^)]*Fresh1G1R[^)]*\)\.dat$/i, '').trim();
}

/** Identifies a DAT by its content: it names the cache file (see the wire schema). */
function revisionOf(entry: ZipEntry): string {
  return `${entry.crc32}-${entry.size}`;
}

async function listCollection(
  preset: Fresh1g1rPreset,
  collection: Collection,
): Promise<DatSourceEntry[]> {
  const entries = await listEntries(assetName(preset, collection));
  return entries
    .filter((entry) => entry.name.toLowerCase().endsWith('.dat'))
    .map((entry) => ({
      name: entry.name,
      system: systemFromFilename(entry.name),
      path: datPath(preset, collection, entry.name),
      revision: revisionOf(entry),
    }));
}

export async function listDatSources(preset: Fresh1g1rPreset): Promise<DatSourceEntry[]> {
  const lists = await Promise.all(
    COLLECTIONS.map((collection) => listCollection(preset, collection)),
  );
  const sources = lists.flat();
  logger.info({ preset, dats: sources.length }, 'Fresh1G1R DATs listed');
  return sources.sort((a, b) => a.system.localeCompare(b.system));
}

async function downloadDat(path: string): Promise<string> {
  const { asset, name } = locateDat(path);
  const start = Date.now();
  const { entry, content } = await readEntry(asset, name);
  const text = content.toString('utf8');
  // Under the revision actually read: a new release may have come out since
  // the list the user picked from.
  await cacheDat(revisionOf(entry), text);
  logger.info({ path, bytes: content.length, ms: Date.now() - start }, 'DAT downloaded');
  return text;
}

export async function fetchDat(
  preset: Fresh1g1rPreset,
  path: string,
  revision: string,
): Promise<DatSummary> {
  locateDat(path); // a path that cannot be looked up later must not be stored
  const cached = await readCachedDat(revision);
  logger.debug({ path, revision, hit: cached !== null }, 'DAT cache lookup');
  const content = cached ?? (await downloadDat(path));

  const summary = addDat(parseDat(content));
  setDatOrigin(summary.id, preset, path);
  logger.info(
    { datId: summary.id, system: summary.system, games: summary.gameCount, preset },
    'DAT loaded from Fresh1G1R',
  );
  return summary;
}
