import { cpus } from 'node:os';
import { basename } from 'node:path';
import { computeCrc32 } from '@/lib/crc32.js';
import type { DatFile } from '@shared/dat.js';
import type { ScanMatch, ScanResult } from '@shared/scan.js';
import { buildCrcIndex, matchFiles } from './matcher.js';
import { matchChdFile } from './chd-match.js';
import { indexGamesByName, matchChdByName } from './chd-name-match.js';

const CONCURRENCY = Math.max(1, cpus().length);
const PROGRESS_INTERVAL = 50;

export interface ScanProgress {
  scanned: number;
  total: number;
  /** The .chd being decompressed to identify it, when there is one. */
  extracting?: string;
}

/**
 * Matches a list of files on disk against a DAT.
 *
 * .chd files never hash to a DAT CRC directly and must never flow through
 * matchFiles' name-equality check (a .chd's name can't equal any single
 * original rom's name by design), so they are matched separately: by name
 * first, by extraction only when the name matches no game, and reported
 * as unknown when neither identifies them.
 */
export async function scanFiles(
  filePaths: string[],
  dat: DatFile,
  onProgress: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  const crcIndex = buildCrcIndex(dat);
  const gamesByName = indexGamesByName(dat);
  const total = filePaths.length;
  let scanned = 0;

  const hashed: { filePath: string; crc: string }[] = [];
  const chdMatched: ScanMatch[] = [];
  const chdUnmatched: string[] = [];

  const matchChd = async (filePath: string): Promise<void> => {
    const byName = matchChdByName(filePath, gamesByName);
    if (byName.length > 0) {
      chdMatched.push(...byName);
      return;
    }
    onProgress({ scanned, total, extracting: basename(filePath) });
    const byContent = await matchChdFile(filePath, crcIndex);
    if (byContent.length > 0) {
      chdMatched.push(...byContent);
    } else {
      chdUnmatched.push(filePath);
    }
  };

  // Sent before any hashing, so the screen leaves "collecting files" as
  // soon as the total is known rather than after the first 50 files.
  onProgress({ scanned, total });

  for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
    const chunk = filePaths.slice(i, i + CONCURRENCY);
    const chunkHashes = await Promise.all(
      chunk.map(async (filePath) => {
        if (filePath.toLowerCase().endsWith('.chd')) {
          await matchChd(filePath);
          return undefined;
        }
        return { filePath, crc: await computeCrc32(filePath) };
      }),
    );
    // Pushed after the chunk settles, in file order — not as each hash
    // finishes, which would make the result order depend on timing.
    for (const entry of chunkHashes) if (entry !== undefined) hashed.push(entry);
    scanned += chunk.length;

    const isReportDue = scanned % PROGRESS_INTERVAL === 0 || scanned === total;
    if (isReportDue) onProgress({ scanned, total });
  }

  const result = matchFiles(hashed, crcIndex);
  result.matched.push(...chdMatched);
  result.unmatched.push(...chdUnmatched);
  return result;
}
