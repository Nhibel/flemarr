import { readdir, rm, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import chdman from 'chdman';
import { computeCrc32 } from '@/lib/crc32.js';
import { logger } from '@/lib/logger.js';
import type { Rom } from '@shared/dat.js';

export interface ConvertGameResult {
  ok: boolean;
  reason?: string;
  // Set on success — the caller needs this to know exactly what was
  // produced (e.g. to serve it to a browser-target download), since the
  // filename is derived from the .cue's own name, not passed in.
  chdPath?: string;
}

/**
 * Converts a disc game's already-downloaded .bin/.cue (sitting in
 * `destinationDir`, one entry per `roms`) into a single .chd, verifies the
 * round-trip is bit-exact against the DAT's own expected CRCs (chdman
 * extractcd back out to a scratch dir, CRC32 each extracted file — the
 * same streaming helper the scanner uses), and only on a full match
 * deletes the originals. Any failure along the way — createcd error,
 * extractcd error, a CRC that doesn't come back — leaves the originals
 * untouched and cleans up only what this function itself created (the
 * half-made .chd, the scratch dir): never destroys a known-good download
 * over a conversion problem.
 *
 * `roms` must be every rom of the game that has a CRC (nodump roms have
 * nothing to verify and aren't expected to round-trip).
 */
export async function convertGameToChd(
  destinationDir: string,
  roms: Rom[],
): Promise<ConvertGameResult> {
  const cueRom = roms.find((r) => r.name.toLowerCase().endsWith('.cue'));
  if (!cueRom) return { ok: false, reason: "no .cue among this game's roms" };

  const cuePath = join(destinationDir, cueRom.name);
  const chdPath = join(destinationDir, `${basename(cueRom.name, '.cue')}.chd`);
  const scratchDir = join(tmpdir(), `flemarr-chd-verify-${randomUUID()}`);

  const start = Date.now();
  logger.info({ cuePath }, 'CHD conversion started');
  try {
    await chdman.createCd({ inputFilename: cuePath, outputFilename: chdPath, force: true });
  } catch (err) {
    await rm(chdPath, { force: true }).catch(() => undefined);
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn({ cuePath, reason }, 'chdman createcd failed');
    return { ok: false, reason: `createcd failed: ${reason}` };
  }

  try {
    await mkdir(scratchDir, { recursive: true });
    await chdman.extractCd({
      inputFilename: chdPath,
      outputFilename: join(scratchDir, 'verify.cue'),
      splitBin: true,
    });

    // extractcd names its own output files (e.g. "verify (Track 1).bin"),
    // never the original DAT names — irrelevant, CRC32 is content-based.
    // Its own regenerated .cue sheet text is skipped entirely: it's a new
    // TOC (different filenames inside it), never byte-identical to the
    // original .cue, so there's nothing meaningful to CRC-compare it
    // against — only the actual track data needs to round-trip exactly.
    const extractedPaths = (await readdir(scratchDir))
      .filter((f) => !f.toLowerCase().endsWith('.cue'))
      .map((f) => join(scratchDir, f));
    const foundCrcs = new Set<string>();
    for (const path of extractedPaths) {
      foundCrcs.add((await computeCrc32(path)).toLowerCase());
    }

    const dataRoms = roms.filter((r) => !r.name.toLowerCase().endsWith('.cue'));
    const missing = dataRoms.filter(
      (r) => r.crc !== undefined && !foundCrcs.has(r.crc.toLowerCase()),
    );
    if (missing.length > 0) {
      throw new Error(`round-trip CRC mismatch for: ${missing.map((r) => r.name).join(', ')}`);
    }
  } catch (err) {
    await rm(chdPath, { force: true }).catch(() => undefined);
    await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn({ chdPath, reason }, 'chd verify failed');
    return { ok: false, reason: `verify failed: ${reason}` };
  }

  await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);

  for (const rom of roms) {
    await rm(join(destinationDir, rom.name), { force: true }).catch(() => undefined);
  }

  logger.info({ chdPath, ms: Date.now() - start }, 'converted disc game to CHD');
  return { ok: true, chdPath };
}
