import type { Game } from '@shared/dat.js';
import type { GameLink } from '@shared/game-link.js';
import type { ScanResult } from '@shared/scan.js';

const NO_LINKED_GAMES: ReadonlySet<string> = new Set();

/**
 * The games the user owns in another version: those a file was attached to
 * by hand, as long as the last scan still found that file.
 */
export function linkedGameIds(links: GameLink[], scan: ScanResult): Set<string> {
  const present = new Set(scan.unmatched.map((file) => file.crc));
  const ids = new Set<string>();
  for (const { gameId, fileCrc } of links) {
    if (gameId !== null && present.has(fileCrc)) ids.add(gameId);
  }
  return ids;
}

/**
 * Selected games the user doesn't own yet, according to the last scan.
 * A game counts as owned only when every one of its ROMs (all discs) was
 * matched on disk — wrongName counts as owned, the file just needs renaming —
 * or when another version of it was attached by hand.
 */
export function computeMissingGameIds(
  selectedIds: Iterable<string>,
  games: Game[],
  scan: ScanResult,
  linked: ReadonlySet<string> = NO_LINKED_GAMES,
): string[] {
  const ownedCrcs = new Set<string>([
    ...scan.matched.map((m) => m.crc),
    ...scan.wrongName.map((w) => w.crc),
  ]);
  const byId = new Map(games.map((g) => [g.id, g]));

  const missing: string[] = [];
  for (const id of selectedIds) {
    const game = byId.get(id);
    if (!game || linked.has(id)) continue;
    // nodump ROMs have no CRC to check ownership against — skip them rather
    // than counting them as always missing (see docs/dat-format.md).
    if (game.roms.some((rom) => rom.crc !== undefined && !ownedCrcs.has(rom.crc))) {
      missing.push(id);
    }
  }
  return missing;
}

/**
 * What the library shows per row: owned, owned but misnamed, or missing.
 *
 * Same CRC-based notion of ownership as computeMissingGameIds above — a
 * game is owned only when every one of its ROMs was found, so a two-disc
 * game with one disc on disk is still missing — but reported per game
 * rather than filtered down to a selection, and with the misnamed case
 * kept separate instead of folded into "owned".
 *
 * `wrongName` means the bytes are on disk under the wrong filename. That
 * is a distinct state because it is the one the scanner can fix in place:
 * nothing needs downloading, only renaming.
 *
 * ROMs with no CRC (nodump entries, see docs/dat-format.md) are skipped
 * rather than counted as absent — there is nothing to compare them
 * against, and treating them as missing marked whole games unownable.
 *
 * `otherVersion` is a game not found as the DAT has it, but one the user
 * attached another version to. The exact version wins over it.
 */
export type Ownership = 'owned' | 'wrongName' | 'otherVersion' | 'missing';

export function computeOwnership(
  games: Game[],
  scan: ScanResult,
  linked: ReadonlySet<string> = NO_LINKED_GAMES,
): Map<string, Ownership> {
  const matchedCrcs = new Set(scan.matched.map((m) => m.crc));
  const wrongNameCrcs = new Set(scan.wrongName.map((w) => w.crc));

  const out = new Map<string, Ownership>();
  for (const game of games) {
    const crcs = game.roms.map((rom) => rom.crc).filter((crc): crc is string => crc !== undefined);

    // Nothing comparable at all (every ROM is a nodump entry): leave the
    // game out of the map entirely rather than guess. An absent entry
    // renders no tag, which is the honest answer — claiming "owned" here
    // would be asserting something the scan cannot know.
    if (crcs.length === 0) {
      if (linked.has(game.id)) out.set(game.id, 'otherVersion');
      continue;
    }

    if (crcs.some((crc) => !matchedCrcs.has(crc) && !wrongNameCrcs.has(crc))) {
      out.set(game.id, linked.has(game.id) ? 'otherVersion' : 'missing');
      continue;
    }
    // Every comparable ROM is on disk. One misnamed file is enough to make
    // the game need a rename, so wrongName wins over owned here.
    out.set(game.id, crcs.some((crc) => wrongNameCrcs.has(crc)) ? 'wrongName' : 'owned');
  }
  return out;
}

/**
 * How many games the scan found on disk, misnamed ones included — a
 * misnamed file is still owned, it only needs a rename.
 */
export function countOwned(ownership: Map<string, Ownership>): number {
  let owned = 0;
  for (const state of ownership.values()) {
    if (state !== 'missing') owned += 1;
  }
  return owned;
}
