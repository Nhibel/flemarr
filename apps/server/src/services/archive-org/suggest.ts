import type { DatFile } from '@shared/dat.js';
import type { ArchiveFile, ArchiveLayout, SearchResult } from '@shared/archive.js';
import { searchArchive } from './search.js';
import { getIndex } from './metadata.js';
import { detectLayout } from './layout.js';

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
const SCORING_CONCURRENCY = 3;
const MIN_COVERAGE = 0.05;
const MAX_RESULTS = 8;

// Common shorthand used by uploaders — the DAT's official name rarely matches
// how collections are titled on archive.org.
const SYSTEM_ALIASES: Record<string, string[]> = {
  'Super Nintendo Entertainment System': ['SNES'],
  'Nintendo Entertainment System': ['NES'],
  'Game Boy Advance': ['GBA'],
  'Game Boy Color': ['GBC'],
  'Nintendo 64': ['N64'],
  'Nintendo DS': ['NDS'],
  'Mega Drive - Genesis': ['Genesis', 'Mega Drive'],
  'Mega CD & Sega CD': ['Sega CD'],
  'Master System - Mark III': ['Master System'],
  'Game Gear': ['Game Gear'],
  PlayStation: ['PSX', 'PS1'],
  'PlayStation 2': ['PS2'],
  'PlayStation Portable': ['PSP'],
  Saturn: ['Sega Saturn'],
  Dreamcast: ['Sega Dreamcast'],
};

/**
 * "Nintendo - Super Nintendo Entertainment System (Retool)"
 * → "Super Nintendo Entertainment System": drop the vendor prefix and any
 * trailing parenthesized tags — "(Retool)" in a query poisons the results.
 */
export function normalizeSystemName(system: string): string {
  let name = system.replace(/^[^-]+-\s*/, '').trim() || system;
  for (;;) {
    const stripped = name.replace(/\s*\([^)]*\)$/, '').trim();
    if (stripped === name || stripped === '') break;
    name = stripped;
  }
  return name || system;
}

export function buildSearchQueries(system: string, source: DatFile['source']): string[] {
  const short = normalizeSystemName(system);
  const authority = source === 'redump' ? 'Redump' : 'No-Intro';
  const names = [short, ...(SYSTEM_ALIASES[short] ?? [])];

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

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Fraction of the sample present in the item's file list. A ROM counts as
 * found on a CRC32 match, an exact filename match, or a ZIP named after it
 * (per-game-zip collections store "Game.sfc" as "Game.zip").
 */
export function scoreIndex(files: ArchiveFile[], sample: { name: string; crc: string }[]): number {
  if (sample.length === 0) return 0;

  const crcs = new Set<string>();
  const names = new Set<string>();
  const zipBasenames = new Set<string>();
  for (const f of files) {
    if (f.crc32) crcs.add(f.crc32.toLowerCase());
    names.add(f.name);
    if (f.name.toLowerCase().endsWith('.zip')) {
      zipBasenames.add(stripExtension(f.name));
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

async function scoreCandidate(
  candidate: SearchResult,
  sample: { name: string; crc: string }[],
): Promise<SourceSuggestion | null> {
  let files: ArchiveFile[];
  try {
    files = await getIndex(candidate.identifier);
  } catch {
    return null; // unreachable item — skip, don't fail the whole suggestion run
  }
  return {
    identifier: candidate.identifier,
    title: candidate.title,
    layout: detectLayout(files),
    fileCount: files.length,
    coverage: scoreIndex(files, sample),
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

  const candidates = new Map<string, SearchResult>();
  let lastError: unknown = null;
  for (const query of queries) {
    try {
      for (const result of await searchArchive(query)) {
        if (!candidates.has(result.identifier)) candidates.set(result.identifier, result);
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (candidates.size === 0 && lastError !== null) throw lastError;

  const ordered = [...candidates.values()]
    .sort((a, b) => (b.itemSize ?? 0) - (a.itemSize ?? 0))
    .slice(0, MAX_SCORED_CANDIDATES);

  const suggestions: SourceSuggestion[] = [];
  for (let i = 0; i < ordered.length; i += SCORING_CONCURRENCY) {
    const chunk = ordered.slice(i, i + SCORING_CONCURRENCY);
    const scored = await Promise.all(chunk.map((c) => scoreCandidate(c, sample)));
    suggestions.push(...scored.filter((s): s is SourceSuggestion => s !== null));
  }

  return suggestions
    .filter((s) => s.coverage >= MIN_COVERAGE)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, MAX_RESULTS);
}
