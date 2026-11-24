import { open } from 'node:fs/promises';
import { computeCrc32, computeCrc32Buffer } from './crc32.js';

const INES_MAGIC = Buffer.from([0x4e, 0x45, 0x53, 0x1a]); // "NES\x1A"
const INES_HEADER_SIZE = 16;

/**
 * Whether `buf` is the expected ROM behind a 16-byte iNES header: it starts
 * with the magic "NES\x1A" and what follows the header has the expected CRC32.
 * The header is never removed: several emulators refuse a file without it.
 *
 * This is the mechanically well-defined half of the NES Headered/Headerless
 * mismatch (see "Name-only matches" in docs/archive-org-strategy.md): a
 * download that carries a header resolved against a Headerless DAT, which
 * expects none. The reverse — synthesizing a header to satisfy a Headered
 * DAT from a genuinely headerless download — isn't attempted: the header
 * encodes per-game mapper/mirroring/PRG-RAM bytes with no general way to
 * derive them, so a guessed header would risk silently producing a
 * corrupt-but-accepted ROM instead of a clean, honest failure.
 */
export function matchesBehindInesHeader(buf: Buffer, expectedCrc: string): boolean {
  if (buf.length <= INES_HEADER_SIZE) return false;
  if (!buf.subarray(0, INES_MAGIC.length).equals(INES_MAGIC)) return false;
  const body = buf.subarray(INES_HEADER_SIZE);
  return computeCrc32Buffer(body) === expectedCrc.toLowerCase();
}

/** The CRC32 of a file without its iNES header, or null when it has none. */
export async function computeCrc32BehindInesHeader(filePath: string): Promise<string | null> {
  const start = Buffer.alloc(INES_MAGIC.length);
  const file = await open(filePath, 'r');
  try {
    await file.read(start, 0, start.length, 0);
  } finally {
    await file.close();
  }
  if (!start.equals(INES_MAGIC)) return null;
  return computeCrc32(filePath, INES_HEADER_SIZE);
}
