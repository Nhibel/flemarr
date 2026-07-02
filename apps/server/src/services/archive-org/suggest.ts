import type { DatFile } from '@shared/dat.js';
import type { ArchiveFile, ArchiveLayout, SearchResult } from '@shared/archive.js';
import { searchArchive } from './search.js';
import { getItemInfo, resolveDownloadUrl } from './metadata.js';
import type { ArchiveItemInfo } from './metadata.js';
import { detectLayout } from './layout.js';
import { urlExists } from './url-check.js';
import { hasArchiveCredentials } from './fetch.js';
import {
  systemNameVariants,
  mentionsSystem,
  baseName,
  stripExtension,
  zipMatchesSystem,
} from './system-name.js';
import { logger } from '@/lib/logger.js';

export interface SourceSuggestion {
  identifier: string;
  title: string;
  layout: ArchiveLayout;
  fileCount: number;
  /** Fraction of the DAT sample found in the item (0..1) */
  coverage: number;
  sampleSize: number;
}

const SAMPLE_SIZE = 50;
const MAX_QUERIES = 4;
const MAX_SCORED_CANDIDATES = 10;
const MAX_ATTEMPTS = 18;
const SCORING_CONCURRENCY = 3;
const MIN_COVERAGE = 0.05;
const MAX_RESULTS = 8;

export { normalizeSystemName } from './system-name.js';

export function buildSearchQueries(system: string, source: DatFile['source']): string[] {
  const authority = source === 'redump' ? 'Redump' : 'No-Intro';
  const names = systemNameVariants(system);

  const queries: string[] = [];
  for (const name of names) queries.push(`${authority} ${name}`);
  for (const name of names) queries.push(`${name} roms`);
  return [...new Set(queries)].slice(0, MAX_QUERIES);
}

/** Evenly-strided sample of ROM entries across the whole DAT. */
export function sampleRoms(dat: DatFile, size = SAMPLE_SIZE): { name: string; crc: string }[] {
  const all = dat.games.flatMap((g) => g.roms.map((r) => ({ name: r.name, crc: r.crc })));
  if (all.length <= size) return all;
  const stride = all.length / size;
  const sample: { name: string; crc: string }[] = [];
  for (let i = 0; i < size; i++) {
    const entry = all[Math.floor(i * stride)];
    if (entry) sample.push(entry);
  }
  return sample;
}

/**
 * Fraction of the sample present in the item's file list. A ROM counts as
 * found on a CRC32 match, a filename match (subdirectory paths compare by
 * basename), or a ZIP named after it (per-game-zip collections store
 * "Game.sfc" as "Game.zip").
 */
export function scoreIndex(files: ArchiveFile[], sample: { name: string; crc: string }[]): number {
  if (sample.length === 0) return 0;

  const crcs = new Set<string>();
  const names = new Set<string>();
  const zipBasenames = new Set<string>();
  for (const f of files) {
    if (f.crc32) crcs.add(f.crc32.toLowerCase());
    names.add(baseName(f.name));
    if (f.name.toLowerCase().endsWith('.zip')) {
      zipBasenames.add(stripExtension(baseName(f.name)));
    }
  }

  let found = 0;
  for (const rom of sample) {
    if (
      crcs.has(rom.crc.toLowerCase()) ||
      names.has(rom.name) ||
      zipBasenames.has(stripExtension(rom.name))
    ) {
      found++;
    }
  }
  return found / sample.length;
}

const PROBE_COUNT = 4;

/**
 * Collections like proper1g1r-collection ship one ZIP per system
 * ("ROMs/Nintendo - Super Nintendo….zip") — nothing in the index matches
 * individual ROMs, so coverage is measured by HEAD-probing a few sample
 * ROMs inside the ZIP whose name matches the system.
 */
export async function probeSystemZip(
  identifier: string,
  files: ArchiveFile[],
  system: string,
  sample: { name: string; crc: string }[],
): Promise<number | null> {
  if (sample.length === 0) return null;

  const systemZips = files
    .filter((f) => f.name.toLowerCase().endsWith('.zip') && zipMatchesSystem(f.name, system))
    .sort((a, b) => b.size - a.size);
  const zip = systemZips[0];
  if (zip === undefined) return null;

  const stride = Math.max(1, Math.floor(sample.length / PROBE_COUNT));
  const probes = Array.from(
    { length: Math.min(PROBE_COUNT, sample.length) },
    (_, i) => sample[i * stride],
  ).filter((r): r is { name: string; crc: string } => r !== undefined);

  // ZIPs often prefix their entries with a folder named like the archive
  // ("Super Nintendo….zip" → "Super Nintendo…/rom.sfc") — try both layouts.
  const folderPrefix = stripExtension(baseName(zip.name));
  let hits = 0;
  for (const rom of probes) {
    if (
      (await urlExists(resolveDownloadUrl(identifier, rom.name, zip.name))) ||
      (await urlExists(resolveDownloadUrl(identifier, `${folderPrefix}/${rom.name}`, zip.name)))
    ) {
      hits++;
    }
  }
  logger.debug({ identifier, zip: zip.name, probes: probes.length, hits }, 'system zip probed');
  return hits / probes.length;
}

async function scoreCandidate(
  candidate: SearchResult,
  sample: { name: string; crc: string }[],
  system: string,
): Promise<SourceSuggestion | null> {
  let info: ArchiveItemInfo;
  try {
    info = await getItemInfo(candidate.identifier);
  } catch {
    return null; // unreachable item — skip, don't fail the whole suggestion run
  }

  // Login-only items can't serve anonymous per-file downloads — most big
  // fullsets are in this category. With archive.org credentials configured
  // they become reachable, so they're scored like any other candidate
  // (the HEAD probes validate real access anyway).
  if (info.restricted && !hasArchiveCredentials()) {
    logger.info({ identifier: candidate.identifier }, 'candidate skipped: access-restricted');
    return null;
  }
  const files = info.files;

  let coverage = scoreIndex(files, sample);
  let layout = detectLayout(files);

  // Static matching found nothing — the collection may still hold the set
  // in a per-system ZIP; measure real coverage with a few HEAD probes.
  if (coverage < MIN_COVERAGE) {
    const probed = await probeSystemZip(candidate.identifier, files, system, sample);
    if (probed !== null && probed > coverage) {
      coverage = probed;
      layout = 'zip-collection';
    }
  }

  logger.info(
    { identifier: candidate.identifier, coverage, layout, fileCount: files.length },
    'candidate scored',
  );

  return {
    identifier: candidate.identifier,
    title: candidate.title,
    layout,
    fileCount: files.length,
    coverage,
    sampleSize: sample.length,
  };
}

/**
 * Search archive.org with several query variants, prioritize big items
 * (a full set weighs GBs, a single-game upload doesn't), score the best
 * candidates against a sample of the DAT and return them ranked by coverage.
 */
export async function suggestSources(dat: DatFile): Promise<SourceSuggestion[]> {
  const sample = sampleRoms(dat);
  const queries = buildSearchQueries(dat.system, dat.source);
  logger.info({ system: dat.system, queries }, 'suggestion run started');

  const candidates = new Map<string, SearchResult>();
  let lastError: unknown = null;
  for (const query of queries) {
    try {
      for (const result of await searchArchive(query)) {
        if (!candidates.has(result.identifier)) candidates.set(result.identifier, result);
      }
    } catch (err) {
      logger.warn(
        { query, err: err instanceof Error ? err.message : String(err) },
        'search failed',
      );
      lastError = err;
    }
  }
  if (candidates.size === 0 && lastError !== null) throw lastError;

  // Candidates whose identifier/title mention the system (or an alias) go
  // first — a dedicated "no-intro_snes" item beats a generic mega-pack —
  // then bigger items first (a full set weighs GBs, a single game doesn't).
  const relevant = (c: SearchResult): number =>
    mentionsSystem(`${c.identifier} ${c.title}`, dat.system) ? 1 : 0;
  const ordered = [...candidates.values()].sort(
    (a, b) => relevant(b) - relevant(a) || (b.itemSize ?? 0) - (a.itemSize ?? 0),
  );
  logger.info({ candidates: candidates.size }, 'candidates gathered');

  // Restricted/unreachable candidates don't consume a scoring slot — keep
  // going down the list until enough are actually scored.
  const suggestions: SourceSuggestion[] = [];
  let attempts = 0;
  for (
    let i = 0;
    i < ordered.length && suggestions.length < MAX_SCORED_CANDIDATES && attempts < MAX_ATTEMPTS;
    i += SCORING_CONCURRENCY
  ) {
    const chunk = ordered.slice(i, i + SCORING_CONCURRENCY);
    attempts += chunk.length;
    const scored = await Promise.all(chunk.map((c) => scoreCandidate(c, sample, dat.system)));
    suggestions.push(...scored.filter((s): s is SourceSuggestion => s !== null));
  }

  const kept = suggestions
    .filter((s) => s.coverage >= MIN_COVERAGE)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, MAX_RESULTS);
  logger.info(
    { kept: kept.map((s) => ({ id: s.identifier, coverage: s.coverage })) },
    'suggestion run finished',
  );
  return kept;
}
