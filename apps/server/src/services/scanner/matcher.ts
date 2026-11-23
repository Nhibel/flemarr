import { basename, dirname } from 'node:path';
import type { DatFile, Game, Rom } from '@shared/dat.js';
import type { ScanMatch, ScanResult, WrongNameEntry } from '@shared/scan.js';

export interface CrcEntry {
  game: Game;
  rom: Rom;
}

/**
 * Every ROM behind a CRC. Several is common on discs: hundreds of tracks are
 * identical (silence, padding), within one game or across games.
 */
export type CrcIndex = Map<string, CrcEntry[]>;

export interface HashedFile {
  filePath: string;
  crc: string;
}

export function buildCrcIndex(dat: DatFile): CrcIndex {
  const index: CrcIndex = new Map();
  for (const game of dat.games) {
    for (const rom of game.roms) {
      // nodump ROMs have no CRC to match against — visible in the UI, but
      // never indexed (see docs/dat-format.md).
      if (rom.crc === undefined) continue;
      const entries = index.get(rom.crc);
      if (entries === undefined) index.set(rom.crc, [{ game, rom }]);
      else entries.push({ game, rom });
    }
  }
  return index;
}

interface Folder {
  crcs: Set<string>;
  /** Names the files carry, then also those proposed to misnamed ones. */
  takenNames: Set<string>;
}

function groupByFolder(files: HashedFile[]): Map<string, Folder> {
  const folders = new Map<string, Folder>();
  for (const { filePath, crc } of files) {
    const path = dirname(filePath);
    const folder = folders.get(path) ?? {
      crcs: new Set(),
      takenNames: new Set(),
    };
    folder.crcs.add(crc);
    folder.takenNames.add(basename(filePath));
    folders.set(path, folder);
  }
  return folders;
}

function countRomsPresent(game: Game, folder: Folder): number {
  return game.roms.filter((rom) => rom.crc !== undefined && folder.crcs.has(rom.crc)).length;
}

/** The entries whose game has the most ROMs in the folder. */
function keepBestExplained(entries: CrcEntry[], folder: Folder): CrcEntry[] {
  const counts = entries.map((entry) => countRomsPresent(entry.game, folder));
  const best = Math.max(...counts);
  return entries.filter((_, position) => counts[position] === best);
}

// What a misnamed file may be renamed to. Several entries of one game are
// identical files, so any of their names will do: one is kept.
function namingCandidates(entries: CrcEntry[], folder: Folder): CrcEntry[] {
  const free = entries.filter((entry) => !folder.takenNames.has(entry.rom.name));
  const best = keepBestExplained(free.length > 0 ? free : entries, folder);
  const gameIds = new Set(best.map((entry) => entry.game.id));
  return gameIds.size === 1 ? best.slice(0, 1) : best;
}

function describeWrongName(
  { filePath, crc }: HashedFile,
  entries: CrcEntry[],
  folder: Folder,
): WrongNameEntry | null {
  const candidates = namingCandidates(entries, folder);
  const first = candidates[0];
  if (first === undefined) return null;

  const entry: WrongNameEntry = {
    filePath,
    currentName: basename(filePath),
    canonicalName: first.rom.name,
    crc,
    gameName: first.game.name,
  };
  if (candidates.length > 1) {
    entry.alternatives = candidates.map((candidate) => candidate.rom.name);
  } else {
    folder.takenNames.add(first.rom.name);
  }
  return entry;
}

export function matchFiles(files: HashedFile[], index: CrcIndex): ScanResult {
  const matched: ScanMatch[] = [];
  const wrongName: WrongNameEntry[] = [];
  const unmatched: string[] = [];
  const folders = groupByFolder(files);

  for (const file of files) {
    const { filePath, crc } = file;
    const entries = index.get(crc);
    const folder = folders.get(dirname(filePath));
    if (entries === undefined || folder === undefined) {
      unmatched.push(filePath);
      continue;
    }

    const currentName = basename(filePath);
    const named = entries.find((entry) => entry.rom.name === currentName);
    if (named !== undefined) {
      matched.push({
        filePath,
        gameName: named.game.name,
        romName: currentName,
        crc,
      });
      continue;
    }
    const misnamed = describeWrongName(file, entries, folder);
    if (misnamed !== null) wrongName.push(misnamed);
  }

  return { matched, wrongName, unmatched };
}
