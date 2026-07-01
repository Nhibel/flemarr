import { basename } from 'node:path';
import type { DatFile, Game, Rom } from '@shared/dat.js';
import type { ScanMatch, ScanResult, WrongNameEntry } from '@shared/scan.js';

interface CrcEntry {
  game: Game;
  rom: Rom;
}

export function buildCrcIndex(dat: DatFile): Map<string, CrcEntry> {
  const index = new Map<string, CrcEntry>();
  for (const game of dat.games) {
    for (const rom of game.roms) {
      index.set(rom.crc, { game, rom });
    }
  }
  return index;
}

export function matchFiles(
  files: { filePath: string; crc: string }[],
  index: Map<string, CrcEntry>,
): ScanResult {
  const matched: ScanMatch[] = [];
  const wrongName: WrongNameEntry[] = [];
  const unmatched: string[] = [];

  for (const { filePath, crc } of files) {
    const entry = index.get(crc);
    if (entry === undefined) {
      unmatched.push(filePath);
      continue;
    }

    const currentName = basename(filePath);
    if (currentName === entry.rom.name) {
      matched.push({ filePath, gameName: entry.game.name, romName: entry.rom.name, crc });
    } else {
      wrongName.push({
        filePath,
        currentName,
        canonicalName: entry.rom.name,
        crc,
        gameName: entry.game.name,
      });
    }
  }

  return { matched, wrongName, unmatched };
}
