import { readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import chdman from 'chdman';
import { computeCrc32 } from '@/lib/crc32.js';
import { logger } from '@/lib/logger.js';
import type { CrcEntry } from './matcher.js';
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
export async function matchChdFile(
  filePath: string,
  index: Map<string, CrcEntry>,
): Promise<ScanMatch[]> {
  const scratchDir = join(tmpdir(), `flemarr-chd-scan-${randomUUID()}`);
  const matched: ScanMatch[] = [];

  try {
    await mkdir(scratchDir, { recursive: true });
    await chdman.extractCd({
      inputFilename: filePath,
      outputFilename: join(scratchDir, 'scan.cue'),
      splitBin: true,
    });

    const extracted = (await readdir(scratchDir)).filter((f) => !f.toLowerCase().endsWith('.cue'));
    const matchedGames = new Map<string, CrcEntry['game']>();
    for (const name of extracted) {
      const crc = await computeCrc32(join(scratchDir, name));
      const entry = index.get(crc);
      if (entry) {
        matched.push({ filePath, gameName: entry.game.name, romName: entry.rom.name, crc });
        matchedGames.set(entry.game.id, entry.game);
      }
    }

    for (const game of matchedGames.values()) {
      const cueRom = game.roms.find(
        (r) => r.name.toLowerCase().endsWith('.cue') && r.crc !== undefined,
      );
      if (!cueRom || matched.some((m) => m.romName === cueRom.name)) continue;
      const otherRoms = game.roms.filter((r) => r !== cueRom && r.crc !== undefined);
      const allOthersMatched = otherRoms.every((r) => matched.some((m) => m.romName === r.name));
      if (allOthersMatched) {
        matched.push({ filePath, gameName: game.name, romName: cueRom.name, crc: cueRom.crc! });
      }
    }
  } catch (err) {
    logger.warn(
      { filePath, error: err instanceof Error ? err.message : String(err) },
      'chd scan extraction failed',
    );
  } finally {
    await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return matched;
}
