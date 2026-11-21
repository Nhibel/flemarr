import type { ScanResult } from '@shared/scan.js';

/**
 * The games a scan found, by name, sorted. `matched` holds one entry per
 * rom of the DAT, so a disc game converted to one .chd shows up once per
 * track and once for its .cue — counting entries would report three games
 * for one.
 */
export function foundGames(result: ScanResult): string[] {
  const names = new Set(result.matched.map((match) => match.gameName));
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * The files on disk the scan looked at. A .chd stands for several roms of
 * the DAT, so it appears in `matched` several times under the same path.
 */
export function scannedFileCount(result: ScanResult): number {
  const paths = new Set<string>();
  for (const match of result.matched) paths.add(match.filePath);
  for (const entry of result.wrongName) paths.add(entry.filePath);
  for (const path of result.unmatched) paths.add(path);
  return paths.size;
}
