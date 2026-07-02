import type { DatFile } from '@shared/dat.js';
import type { ArchiveFile, ArchiveLayout } from '@shared/archive.js';
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
const CANDIDATE_LIMIT = 5;

// "Nintendo - Super Nintendo Entertainment System" → "Super Nintendo Entertainment System"
function shortSystemName(system: string): string {
  return system.replace(/^[^-]+-\s*/, '').trim() || system;
}

export function buildSearchQuery(system: string, source: DatFile['source']): string {
  return `${source === 'redump' ? 'Redump' : 'No-Intro'} ${shortSystemName(system)}`;
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

/**
 * Search archive.org for the DAT's system, score the top candidates against
 * a sample of the DAT, and return them ranked by coverage.
 */
export async function suggestSources(dat: DatFile): Promise<SourceSuggestion[]> {
  const results = await searchArchive(buildSearchQuery(dat.system, dat.source));
  const sample = sampleRoms(dat);

  const suggestions: SourceSuggestion[] = [];
  for (const candidate of results.slice(0, CANDIDATE_LIMIT)) {
    let files: ArchiveFile[];
    try {
      files = await getIndex(candidate.identifier);
    } catch {
      continue; // unreachable item — skip, don't fail the whole suggestion run
    }
    suggestions.push({
      identifier: candidate.identifier,
      title: candidate.title,
      layout: detectLayout(files),
      fileCount: files.length,
      coverage: scoreIndex(files, sample),
      sampleSize: sample.length,
    });
  }

  return suggestions.sort((a, b) => b.coverage - a.coverage);
}
