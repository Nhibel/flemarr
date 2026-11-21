import type { DatUpdate, Fresh1g1rPreset } from '@shared/fresh1g1r.js';
import { listFresh1g1rDats } from '@/services/dat/index.js';
import type { Fresh1g1rDat } from '@/services/dat/index.js';
import { listDatSources, rawUrl } from './index.js';

// Fresh1G1R regenerates every DAT daily, so the file (and its git sha)
// changes every day even when no game does. The header's <version> is the
// upstream No-Intro/Redump set version: it only moves when the set does.
const HEADER_BYTES = 4096;
const VERSION_PATTERN = /<version>([^<]*)<\/version>/;

// GitHub's unauthenticated API allows 60 requests an hour; a check costs two
// per preset. The answer is kept a few hours, and dropped when a DAT is
// (re)loaded so a done update stops showing at once.
const CHECK_TTL_MS = 6 * 60 * 60 * 1000;
let lastCheck: { at: number; updates: DatUpdate[] } | null = null;

export function forgetDatUpdates(): void {
  lastCheck = null;
}

/** The set version in a published DAT's header, reading only its first bytes. */
export async function publishedVersion(path: string): Promise<string | null> {
  const res = await fetch(rawUrl(path), {
    headers: { Range: `bytes=0-${HEADER_BYTES - 1}`, 'User-Agent': 'flemarr/1.0' },
  });
  if (!res.ok) return null;
  return VERSION_PATTERN.exec(await res.text())?.[1]?.trim() ?? null;
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
    if (entry === undefined) continue;
    const version = await publishedVersion(entry.path);
    if (version === null || version === dat.version) continue;
    updates.push({ datId: dat.id, preset, path: entry.path, sha: entry.sha, version });
  }
  return updates;
}

/** The DATs loaded from Fresh1G1R whose set has a newer published version. */
export async function findDatUpdates(now: number = Date.now()): Promise<DatUpdate[]> {
  if (lastCheck !== null && now - lastCheck.at < CHECK_TTL_MS) return lastCheck.updates;
  const updates: DatUpdate[] = [];
  for (const [preset, dats] of byPreset(listFresh1g1rDats())) {
    updates.push(...(await checkPreset(preset, dats)));
  }
  lastCheck = { at: now, updates };
  return updates;
}
