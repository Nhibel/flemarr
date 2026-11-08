import type { Game } from '@shared/dat.js';
import type { ScanResult } from '@shared/scan.js';

/**
 * Selected games the user doesn't own yet, according to the last scan.
 * A game counts as owned only when every one of its ROMs (all discs) was
 * matched on disk — wrongName counts as owned, the file just needs renaming.
 */
export function computeMissingGameIds(
  selectedIds: Iterable<string>,
  games: Game[],
  scan: ScanResult,
): string[] {
  const ownedCrcs = new Set<string>([
    ...scan.matched.map((m) => m.crc),
    ...scan.wrongName.map((w) => w.crc),
  ]);
  const byId = new Map(games.map((g) => [g.id, g]));

  const missing: string[] = [];
  for (const id of selectedIds) {
    const game = byId.get(id);
    if (!game) continue;
    // nodump ROMs have no CRC to check ownership against — skip them rather
    // than counting them as always missing (see docs/dat-format.md).
    if (game.roms.some((rom) => rom.crc !== undefined && !ownedCrcs.has(rom.crc))) {
      missing.push(id);
    }
  }
  return missing;
}
