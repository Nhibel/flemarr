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
