import type { ArchiveSource, ResolveResponse } from '@/lib/api.js';
import type { ResolvedGame } from '@shared/archive.js';

export interface ResolveSummary {
  /** Games where every ROM has at least one source. */
  complete: number;
  /** Games where some ROMs have a source and others don't. */
  partial: number;
  /** Games where no ROM has a source (a game with no ROM at all counts here). */
  notFound: number;
  /** ROMs with at least one source — one download item each. */
  downloadableCount: number;
}

/**
 * Identifies a source list, so resolve results can tell they were computed
 * against a list that has since changed. Layout included: correcting a
 * wrongly-detected layout changes which URLs resolve, not just which sources
 * exist. Sorted so the order sources were added in doesn't matter.
 */
export function sourceKeyOf(sources: readonly ArchiveSource[]): string {
  return sources
    .map((source) => `${source.identifier}:${source.layout}`)
    .sort()
    .join('|');
}

function countFoundRoms(game: ResolvedGame): number {
  return game.roms.filter((rom) => rom.sources.length > 0).length;
}

export function summarizeResolve(result: ResolveResponse): ResolveSummary {
  const summary: ResolveSummary = { complete: 0, partial: 0, notFound: 0, downloadableCount: 0 };
  for (const game of result.results) {
    const found = countFoundRoms(game);
    summary.downloadableCount += found;
    if (found === 0) {
      summary.notFound += 1;
    } else if (found === game.roms.length) {
      summary.complete += 1;
    } else {
      summary.partial += 1;
    }
  }
  return summary;
}
