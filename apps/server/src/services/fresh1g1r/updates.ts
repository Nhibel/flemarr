import type { DatUpdate, Fresh1g1rPreset } from '@shared/fresh1g1r.js';
import { listFresh1g1rDats } from '@/services/dat/index.js';
import type { Fresh1g1rDat } from '@/services/dat/index.js';
import { logger } from '@/lib/logger.js';
import { locateDat } from './dat-path.js';
import { listDatSources } from './index.js';
import { readEntryStart } from './release-asset.js';

// Fresh1G1R regenerates every DAT daily, so the file (and its revision)
// changes every day even when no game does. The header's <version> is the
// upstream No-Intro/Redump set version: it only moves when the set does.
const HEADER_COMPRESSED_BYTES = 8192;
const VERSION_PATTERN = /<version>([^<]*)<\/version>/;

// A check costs a request per loaded DAT, and releases are daily. The answer
// is kept a few hours, and dropped when a DAT is (re)loaded so a done update
// stops showing at once.
const CHECK_TTL_MS = 6 * 60 * 60 * 1000;
let lastCheck: { at: number; updates: DatUpdate[] } | null = null;

export function forgetDatUpdates(): void {
  lastCheck = null;
}

/** The set version in a published DAT's header, reading only its first bytes. */
export async function publishedVersion(path: string): Promise<string | null> {
  const { asset, name } = locateDat(path);
  const start = await readEntryStart(asset, name, HEADER_COMPRESSED_BYTES);
  return VERSION_PATTERN.exec(start.toString('utf8'))?.[1]?.trim() ?? null;
}

function byPreset(dats: Fresh1g1rDat[]): Map<Fresh1g1rPreset, Fresh1g1rDat[]> {
  const grouped = new Map<Fresh1g1rPreset, Fresh1g1rDat[]>();
  for (const dat of dats) {
    const group = grouped.get(dat.preset) ?? [];
    group.push(dat);
    grouped.set(dat.preset, group);
  }
  return grouped;
}

async function checkPreset(preset: Fresh1g1rPreset, dats: Fresh1g1rDat[]): Promise<DatUpdate[]> {
  const published = new Map((await listDatSources(preset)).map((entry) => [entry.path, entry]));
  const updates: DatUpdate[] = [];
  for (const dat of dats) {
    const entry = published.get(dat.path);
    if (entry === undefined) {
      logger.warn({ datId: dat.id, path: dat.path }, 'loaded DAT no longer published');
      continue;
    }
    const version = await publishedVersion(entry.path);
    if (version === null || version === dat.version) continue;
    updates.push({ datId: dat.id, preset, path: entry.path, revision: entry.revision, version });
  }
  return updates;
}

/** The DATs loaded from Fresh1G1R whose set has a newer published version. */
export async function findDatUpdates(now: number = Date.now()): Promise<DatUpdate[]> {
  if (lastCheck !== null && now - lastCheck.at < CHECK_TTL_MS) return lastCheck.updates;
  const loaded = listFresh1g1rDats();
  const updates: DatUpdate[] = [];
  for (const [preset, dats] of byPreset(loaded)) {
    updates.push(...(await checkPreset(preset, dats)));
  }
  logger.info({ checked: loaded.length, updates: updates.length }, 'DAT updates checked');
  lastCheck = { at: now, updates };
  return updates;
}
