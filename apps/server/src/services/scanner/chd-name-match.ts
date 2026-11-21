import { basename } from 'node:path';
import type { DatFile, Game } from '@shared/dat.js';
import type { ScanMatch } from '@shared/scan.js';

const CHD_EXTENSION = '.chd';

export function indexGamesByName(dat: DatFile): Map<string, Game> {
  return new Map(dat.games.map((game) => [game.name, game]));
}

/**
 * Identifies a .chd by its filename alone: `<game name>.chd` is that game.
 *
 * This is the scanner's first try for a .chd, before extracting it (see
 * chd-match.ts), which means decompressing a whole disc to a temp dir on
 * every scan — long seconds per game. Camille chose (2026-11-21) to trust
 * the name instead: the .chd files Flemarr writes are named this way and
 * verified track by track when converted. The accepted cost is that a
 * correctly named but corrupt .chd, or one holding another game, reads as
 * found. Only a .chd whose name matches no game is extracted.
 *
 * Returns one match per rom of the game that has a CRC — the same shape
 * matchChdFile produces — so ownership and the stored last scan read it
 * the same way. Returns nothing when the name matches no game.
 */
export function matchChdByName(filePath: string, gamesByName: Map<string, Game>): ScanMatch[] {
  const fileName = basename(filePath);
  if (!fileName.toLowerCase().endsWith(CHD_EXTENSION)) return [];

  const gameName = fileName.slice(0, -CHD_EXTENSION.length);
  const game = gamesByName.get(gameName);
  if (game === undefined) return [];

  const matches: ScanMatch[] = [];
  for (const rom of game.roms) {
    if (rom.crc === undefined) continue;
    matches.push({ filePath, gameName: game.name, romName: rom.name, crc: rom.crc });
  }
  return matches;
}
