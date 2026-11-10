import type { DatFile } from '@shared/dat.js';
import type { ArchiveFile, ArchiveLayout, SearchResult } from '@shared/archive.js';
import { searchArchive } from './search.js';
import { getItemInfo } from './metadata.js';
import type { ArchiveItemInfo } from './metadata.js';
import { detectLayout } from './layout.js';
import { getZipListing } from './zip-listing.js';
import { hasArchiveCredentials } from './fetch.js';
import { KNOWN_NO_INTRO_IDENTIFIERS } from './known-sources.js';
import {
  systemNameVariants,
  mentionsSystem,
  baseName,
  stripExtension,
  zipSystemMatch,
  isReencodedDump,
} from './system-name.js';
import { logger } from '@/lib/logger.js';

export interface SourceSuggestion {
  identifier: string;
  title: string;
  layout: ArchiveLayout;
  fileCount: number;
  /** Fraction of the sampled *games* present in the item (0..1) — CRC + name-only blended, used for ranking */
  coverage: number;
  /** Fraction found specifically by CRC32 equality — the trustworthy subset of `coverage` */
  crcCoverage: number;
  /** How many games were sampled (not ROM entries) */
  sampleSize: number;
}

export interface CoverageScore {
  /** Games with at least one ROM matched by CRC32 */
  crcFound: number;
  /** Games matched by name/ZIP-entry only — a guess, not a guarantee */
  nameOnlyFound: number;
  /** Games sampled */
  total: number;
}

/** A sampled game: its DAT name, and the ROMs that can be matched at all. */
export interface SampledGame {
  name: string;
  roms: { name: string; crc: string }[];
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

/**
 * Evenly-strided sample of *games* across the whole DAT.
 *
 * Sampling ROM entries instead systematically understated per-game-zip
 * collections on disc systems: a Redump game is one ".cue" plus one ".bin"
 * per track, and a ZIP named after the game can only ever match the cue. A
 * 12-track game therefore capped a perfect source at 8%. Coverage is a
 * question about games ("do I get this game?"), so the sample is games.
 */
export function sampleGames(dat: DatFile, size = SAMPLE_SIZE): SampledGame[] {
  // nodump ROMs have no CRC — nothing to compare a source's listing against
  // (see docs/dat-format.md); a game with no scorable ROM at all is dropped.
  const all = dat.games
    .map((g) => ({
      name: g.name,
      roms: g.roms.filter((r) => r.crc !== undefined).map((r) => ({ name: r.name, crc: r.crc! })),
    }))
    .filter((g) => g.roms.length > 0);
  if (all.length <= size) return all;
  const stride = all.length / size;
  const sample: SampledGame[] = [];
  for (let i = 0; i < size; i++) {
    const entry = all[Math.floor(i * stride)];
    if (entry) sample.push(entry);
  }
  return sample;
}

/**
 * Does any file name in `names` (already basename + extension-stripped) stand
 * for this game? Either a file per ROM, or one named after the game itself —
 * which is how per-game-zip collections store a multi-track disc.
 *
 * The game name is compared raw: DAT names carry no extension, and stripping
 * one would mangle a title like "E.T. the Extra-Terrestrial (USA)".
 */
function gameMatchesByName(names: Set<string>, game: SampledGame): boolean {
  if (names.has(game.name)) return true;
  return game.roms.some((r) => names.has(stripExtension(r.name)));
}

/**
 * How many sampled games the item's file list accounts for, split by how
 * trustworthy the match is: `crcFound` means at least one of the game's ROMs
 * matched by CRC32 (the downloader's own check should pass); `nameOnlyFound`
 * is a filename match — extension ignored, so a ZIP named after the ROM or
 * the game counts (per-game-zip collections store "Game.sfc" as "Game.zip"),
 * and so does a DAT variant whose naming convention doesn't match real
 * uploads (e.g. a NES "Headerless" DAT names its roms "*.unh", which no
 * archive.org upload ever uses) — plausible, but unconfirmed (see
 * "Name-only matches" in docs/archive-org-strategy.md).
 */
export function scoreIndex(files: ArchiveFile[], sample: SampledGame[]): CoverageScore {
  if (sample.length === 0) return { crcFound: 0, nameOnlyFound: 0, total: 0 };

  const crcs = new Set<string>();
  const names = new Set<string>();
  for (const f of files) {
    if (f.crc32) crcs.add(f.crc32.toLowerCase());
    // A re-encode (.chd, .rvz…) carries the game but not the DAT's bytes.
    // Since name matching ignores extensions, it would otherwise score as a
    // hit for a file that is guaranteed to fail CRC validation on download.
    if (!isReencodedDump(f.name)) names.add(stripExtension(baseName(f.name)));
  }

  let crcFound = 0;
  let nameOnlyFound = 0;
  for (const game of sample) {
    // One matched ROM is enough to say the item carries the game: a partial
    // disc is the resolver's problem to report, not the suggester's.
    if (game.roms.some((r) => crcs.has(r.crc.toLowerCase()))) {
      crcFound++;
    } else if (gameMatchesByName(names, game)) {
      nameOnlyFound++;
    }
  }
  return { crcFound, nameOnlyFound, total: sample.length };
}

/**
 * Collections like proper1g1r-collection / ni-roms ship one ZIP per system
 * ("roms/Sega - Mega Drive….zip"); nothing in the item's file list matches
 * individual ROMs. Coverage is measured against the ZIP's inner listing (the
 * datanode view_archive endpoint, which also reaches restricted items) — the
 * same path the resolver uses, so scoring and resolution agree.
 */
async function probeSystemZip(
  info: ArchiveItemInfo,
  system: string,
  sample: SampledGame[],
): Promise<number | null> {
  if (sample.length === 0 || !info.server || !info.dir) return null;

  // Only an exact match is this system's own ZIP. A loose one can be a longer
  // system's set ("Game Boy Advance" matches "Game Boy") and, holding far
  // bigger ROMs, it used to win on size alone — then scored zero against this
  // system's sample and sank the whole candidate below MIN_COVERAGE.
  const matches = info.files
    .filter((f) => f.name.toLowerCase().endsWith('.zip'))
    .map((file) => ({ file, kind: zipSystemMatch(file.name, system) }))
    .filter((m) => m.kind !== null);
  const exact = matches.filter((m) => m.kind === 'exact');
  const pool = exact.length > 0 ? exact : matches;
  const zip = pool.sort((a, b) => b.file.size - a.file.size)[0]?.file;
  if (zip === undefined) return null;

  let entries: string[];
  try {
    entries = await getZipListing(info.server, info.dir, zip.name);
  } catch {
    return null;
  }
  // Inner names are "<rom>.zip" (re-zipped) or the raw ROM — match by basename.
  const innerBases = new Set(
    entries.filter((e) => !isReencodedDump(e)).map((e) => stripExtension(baseName(e))),
  );
  const hits = sample.filter((game) => gameMatchesByName(innerBases, game)).length;
  logger.debug(
    { zip: zip.name, innerEntries: entries.length, sample: sample.length, hits },
    'system zip listing scored',
  );
  return hits / sample.length;
}

async function scoreCandidate(
  candidate: SearchResult,
  sample: SampledGame[],
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

  const score = scoreIndex(files, sample);
  let coverage = score.total > 0 ? (score.crcFound + score.nameOnlyFound) / score.total : 0;
  let crcCoverage = score.total > 0 ? score.crcFound / score.total : 0;
  let layout = detectLayout(files);

  // Static matching found nothing — the collection may still hold the set in a
  // per-system ZIP; measure real coverage against that ZIP's inner listing.
  if (coverage < MIN_COVERAGE) {
    const probed = await probeSystemZip(info, system, sample);
    if (probed !== null && probed > coverage) {
      coverage = probed;
      // A ZIP's inner listing only gives names, never hashes — this subset
      // of "coverage" is never CRC-backed.
      crcCoverage = 0;
      layout = 'zip-collection';
    }
  }

  logger.info(
    { identifier: candidate.identifier, coverage, crcCoverage, layout, fileCount: files.length },
    'candidate scored',
  );

  return {
    identifier: candidate.identifier,
    title: candidate.title,
    layout,
    fileCount: files.length,
    coverage,
    crcCoverage,
    sampleSize: sample.length,
  };
}

/**
 * Search archive.org with several query variants, prioritize big items
 * (a full set weighs GBs, a single-game upload doesn't), score the best
 * candidates against a sample of the DAT and return them ranked by coverage.
 */
export async function suggestSources(dat: DatFile): Promise<SourceSuggestion[]> {
  const sample = sampleGames(dat);
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

  // Known multi-system collections never match a per-system search query —
  // inject them as candidates; scoring validates them like the others. They
  // are all No-Intro sets, so for a Redump DAT they would only burn scoring
  // slots on collections that cannot hold a single disc-based game.
  const seedIds = dat.source === 'no-intro' ? KNOWN_NO_INTRO_IDENTIFIERS : [];
  for (const id of seedIds) {
    if (!candidates.has(id)) {
      candidates.set(id, { identifier: id, title: id, description: '' });
    }
  }
  const seeded = new Set(seedIds);

  // Curated multi-system identifiers first (no itemSize — they'd sink),
  // then candidates whose identifier/title mention the system (or an alias)
  // — a dedicated "no-intro_snes" item beats a generic mega-pack — then
  // bigger items first (a full set weighs GBs, a single game doesn't).
  const relevant = (c: SearchResult): number =>
    seeded.has(c.identifier) ? 2 : mentionsSystem(`${c.identifier} ${c.title}`, dat.system) ? 1 : 0;
  const ordered = [...candidates.values()].sort(
    (a, b) => relevant(b) - relevant(a) || (b.itemSize ?? 0) - (a.itemSize ?? 0),
  );
  logger.info({ candidates: candidates.size }, 'candidates gathered');

  // The budget counts candidates worth keeping, not candidates looked at: a
  // zero-coverage result is as useless as an unreachable one, and counting it
  // stopped the search before it ever reached the real sets. (A PS1 run spent
  // its ten slots on No-Intro seeds and on PS2/PSP items that merely rank
  // bigger, and surfaced nothing usable.) MAX_ATTEMPTS still bounds the cost.
  const suggestions: SourceSuggestion[] = [];
  let attempts = 0;
  let kept = 0;
  for (
    let i = 0;
    i < ordered.length && kept < MAX_SCORED_CANDIDATES && attempts < MAX_ATTEMPTS;
    i += SCORING_CONCURRENCY
  ) {
    const chunk = ordered.slice(i, i + SCORING_CONCURRENCY);
    attempts += chunk.length;
    const scored = await Promise.all(chunk.map((c) => scoreCandidate(c, sample, dat.system)));
    for (const s of scored) {
      if (s === null) continue;
      suggestions.push(s);
      if (s.coverage >= MIN_COVERAGE) kept++;
    }
  }

  const results = suggestions
    .filter((s) => s.coverage >= MIN_COVERAGE)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, MAX_RESULTS);
  logger.info(
    {
      attempts,
      scored: suggestions.length,
      kept: results.map((s) => ({ id: s.identifier, coverage: s.coverage })),
    },
    'suggestion run finished',
  );
  return results;
}
