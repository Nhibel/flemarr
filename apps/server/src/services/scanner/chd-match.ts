import { readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import chdman from 'chdman';
import { computeCrc32 } from '@/lib/crc32.js';
import { logger } from '@/lib/logger.js';
import type { Game, Rom } from '@shared/dat.js';
import type { CrcIndex } from './matcher.js';
import type { ScanMatch } from '@shared/scan.js';

/**
 * The scanner's fallback for a .chd whose name matches no game (see
 * chd-name-match.ts, tried first): extracting a whole disc takes long
 * seconds, so only a .chd that cannot be identified otherwise pays for it.
 *
 * Matches a .chd on disk against the DAT by extracting it (chdman
 * extractcd) and CRC32-hashing each extracted track — the .chd's own bytes
 * never produce the DAT's raw CRC32, and chdman exposes no per-track hash
 * in its own metadata to read instead (confirmed with a real test CHD; see
 * the CHD-conversion plan). Every match is reported directly as `matched`,
 * never `wrongName`: a .chd's filename can never equal any single
 * original rom's name by design (one file stands in for several), so the
 * ordinary name-equality check in matchFiles would always call it a
 * rename candidate — which would be wrong (there's nothing to rename a
 * multi-rom .chd *to*) and dangerous (the rename UI pairs one `from` path
 * with one `to` name; two tracks sharing this same .chd path would race
 * to rename the same file to two different names).
 *
 * The DAT's own .cue rom is a separate problem: chdman's extractcd
 * regenerates a brand new cue sheet (different embedded filenames), which
 * never reproduces the original .cue's exact bytes — so its CRC can never
 * be found this way either. Once every *other* rom of the same game is
 * accounted for, the .cue is reported as matched too (using the DAT's own
 * expected CRC for display) — otherwise a fully, correctly converted disc
 * would read as permanently missing one file forever.
 */
export async function matchChdFile(filePath: string, index: CrcIndex): Promise<ScanMatch[]> {
  const scratchDir = join(tmpdir(), `flemarr-chd-scan-${randomUUID()}`);

  try {
    await mkdir(scratchDir, { recursive: true });
    await chdman.extractCd({
      inputFilename: filePath,
      outputFilename: join(scratchDir, 'scan.cue'),
      splitBin: true,
    });

    const extracted = (await readdir(scratchDir)).filter((f) => !f.toLowerCase().endsWith('.cue'));
    const crcs: string[] = [];
    for (const name of extracted) crcs.push(await computeCrc32(join(scratchDir, name)));
    return matchTracks(filePath, crcs, index);
  } catch (err) {
    logger.warn(
      { filePath, error: err instanceof Error ? err.message : String(err) },
      'chd scan extraction failed',
    );
  } finally {
    await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return [];
}

function countTracksPerGame(crcs: string[], index: CrcIndex): Map<string, number> {
  const counts = new Map<string, number>();
  for (const crc of crcs) {
    const gameIds = new Set((index.get(crc) ?? []).map((entry) => entry.game.id));
    for (const id of gameIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function inferCue(filePath: string, game: Game, matched: ScanMatch[]): ScanMatch | null {
  const isMatched = (rom: Rom) =>
    matched.some((match) => match.gameName === game.name && match.romName === rom.name);
  const cue = game.roms.find(
    (rom) => rom.name.toLowerCase().endsWith('.cue') && rom.crc !== undefined,
  );
  if (cue?.crc === undefined || isMatched(cue)) return null;
  const others = game.roms.filter((rom) => rom !== cue && rom.crc !== undefined);
  if (!others.every(isMatched)) return null;
  return { filePath, gameName: game.name, romName: cue.name, crc: cue.crc };
}

/**
 * Attributes a disc's tracks, by CRC. A track several games share goes to the
 * one that explains the most tracks of this disc.
 */
export function matchTracks(filePath: string, crcs: string[], index: CrcIndex): ScanMatch[] {
  const counts = countTracksPerGame(crcs, index);
  const matched: ScanMatch[] = [];
  const games = new Map<string, Game>();
  const claimed = new Set<Rom>();

  for (const crc of crcs) {
    const entries = [...(index.get(crc) ?? [])].sort(
      (a, b) => (counts.get(b.game.id) ?? 0) - (counts.get(a.game.id) ?? 0),
    );
    const likeliest = entries[0];
    if (likeliest === undefined) continue;
    const sameGame = entries.filter((entry) => entry.game.id === likeliest.game.id);
    // Identical tracks of one game each stand for their own ROM.
    const { game, rom } = sameGame.find((entry) => !claimed.has(entry.rom)) ?? likeliest;
    claimed.add(rom);
    games.set(game.id, game);
    matched.push({ filePath, gameName: game.name, romName: rom.name, crc });
  }

  for (const game of games.values()) {
    const cue = inferCue(filePath, game, matched);
    if (cue !== null) matched.push(cue);
  }
  return matched;
}
