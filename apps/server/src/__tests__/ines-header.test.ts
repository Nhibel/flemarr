import { describe, it, expect } from 'vitest';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { stripInesHeaderIfMatches } from '../lib/ines-header.js';

function inesHeader(): Buffer {
  // Minimal 16-byte iNES header: magic + arbitrary (irrelevant) remaining bytes.
  return Buffer.concat([Buffer.from([0x4e, 0x45, 0x53, 0x1a]), Buffer.alloc(12)]);
}

describe('stripInesHeaderIfMatches', () => {
  it('strips a genuine iNES header when the remainder matches the expected CRC', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([inesHeader(), rom]);
    const expectedCrc = computeCrc32Buffer(rom);

    const result = stripInesHeaderIfMatches(buf, expectedCrc);
    expect(result).not.toBeNull();
    expect(result!.equals(rom)).toBe(true);
  });

  it('returns null when there is no iNES magic at all', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([Buffer.alloc(16), rom]);
    const expectedCrc = computeCrc32Buffer(rom);

    expect(stripInesHeaderIfMatches(buf, expectedCrc)).toBeNull();
  });

  it('returns null when the magic is present but the stripped CRC still does not match', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([inesHeader(), rom]);

    expect(stripInesHeaderIfMatches(buf, 'deadbeef')).toBeNull();
  });

  it('returns null for a buffer too short to carry a header', () => {
    expect(stripInesHeaderIfMatches(Buffer.from([0x4e, 0x45]), 'aabbccdd')).toBeNull();
  });

  it('is case-insensitive on the expected CRC', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([inesHeader(), rom]);
    const expectedCrc = computeCrc32Buffer(rom).toUpperCase();

    expect(stripInesHeaderIfMatches(buf, expectedCrc)).not.toBeNull();
  });
});
