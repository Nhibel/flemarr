import type { GameLink } from '@shared/game-link.js';
import type { ScanResult, UnmatchedFile } from '@shared/scan.js';

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
  for (const file of result.unmatched) paths.add(file.filePath);
  return paths.size;
}

export interface LinkedFile {
  filePath: string;
  crc: string;
  link: GameLink;
}

/** The files the DAT does not list: those attached to a game, and the rest. */
export function splitUnmatched(
  files: UnmatchedFile[],
  links: GameLink[],
): { linked: LinkedFile[]; unlinked: UnmatchedFile[] } {
  const linkByCrc = new Map(links.map((link) => [link.fileCrc, link]));
  const linked: LinkedFile[] = [];
  const unlinked: UnmatchedFile[] = [];
  for (const file of files) {
    const link = file.crc === undefined ? undefined : linkByCrc.get(file.crc);
    if (link === undefined) unlinked.push(file);
    else linked.push({ filePath: file.filePath, crc: link.fileCrc, link });
  }
  return { linked, unlinked };
}

/** The games the user has: found, misnamed, or attached to a file. */
export function ownedGameNames(result: ScanResult, linked: LinkedFile[]): Set<string> {
  const names = new Set<string>();
  for (const match of result.matched) names.add(match.gameName);
  for (const entry of result.wrongName) names.add(entry.gameName);
  for (const { link } of linked) names.add(link.gameName);
  return names;
}
