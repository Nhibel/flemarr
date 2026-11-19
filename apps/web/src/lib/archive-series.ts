// Archive.org has no fixed naming convention for a collection split across
// several items — this only recognizes the common "...part1/part2",
// "...disc1/disc2", "...cd1/cd2", "...disk1/disk2" suffix patterns.
const SERIES_SUFFIX = /^(.+)[-_]?(?:part|disc|cd|disk)[-_]?(\d+)$/i;

/**
 * The shared prefix of a split-collection identifier (e.g.
 * "sony_playstation_part1" → "sony_playstation"), or null if it doesn't
 * look like one. Greedy on the prefix so a word earlier in the identifier
 * isn't mistaken for the suffix keyword (e.g. "deluxe_cdrom_disc1" →
 * "deluxe_cdrom", not "deluxe_" from matching "cd" inside "cdrom").
 */
export function seriesBase(identifier: string): string | null {
  const match = SERIES_SUFFIX.exec(identifier);
  if (!match) return null;
  // The separator before the keyword is optional, so greedy backtracking
  // can leave it inside the prefix capture instead of the suffix — strip it
  // either way rather than depend on which of the two equally-valid splits
  // the regex engine happens to pick.
  return match[1]!.replace(/[-_]+$/, '');
}

/**
 * Completes search results with the other parts of any split collection
 * among them. The normal text search surfaces an arbitrary subset of
 * "sony_playstation_part1".."part5"; once one sibling is found, a prefix
 * search (a trailing "*" is plain archive.org query syntax) finds the
 * others without the user knowing the naming pattern.
 *
 * `search` is injected so this stays testable without the network.
 * Results keep their first-seen order; a sibling found twice appears once.
 */
export async function withSeriesSiblings<T extends { identifier: string }>(
  results: T[],
  search: (query: string) => Promise<T[]>,
): Promise<T[]> {
  const bases = new Set<string>();
  for (const result of results) {
    const base = seriesBase(result.identifier);
    if (base !== null) bases.add(base);
  }
  if (bases.size === 0) return results;

  const siblingBatches = await Promise.all([...bases].map((base) => search(`${base}*`)));
  const byIdentifier = new Map(results.map((result) => [result.identifier, result]));
  for (const sibling of siblingBatches.flat()) byIdentifier.set(sibling.identifier, sibling);
  return [...byIdentifier.values()];
}
