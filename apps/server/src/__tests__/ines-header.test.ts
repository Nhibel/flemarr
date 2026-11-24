import { describe, it, expect } from 'vitest';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { matchesBehindInesHeader } from '../lib/ines-header.js';

function inesHeader(): Buffer {
  // Minimal 16-byte iNES header: magic + arbitrary (irrelevant) remaining bytes.
  return Buffer.concat([Buffer.from([0x4e, 0x45, 0x53, 0x1a]), Buffer.alloc(12)]);
}

describe('matchesBehindInesHeader', () => {
  it('recognizes the expected ROM behind a genuine iNES header', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([inesHeader(), rom]);
    const expectedCrc = computeCrc32Buffer(rom);

    expect(matchesBehindInesHeader(buf, expectedCrc)).toBe(true);
  });

  it('refuses a file with no iNES magic at all', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([Buffer.alloc(16), rom]);
    const expectedCrc = computeCrc32Buffer(rom);

    expect(matchesBehindInesHeader(buf, expectedCrc)).toBe(false);
  });

  it('refuses when the magic is present but the remainder does not match', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([inesHeader(), rom]);

    expect(matchesBehindInesHeader(buf, 'deadbeef')).toBe(false);
  });

  it('refuses a buffer too short to carry a header', () => {
    expect(matchesBehindInesHeader(Buffer.from([0x4e, 0x45]), 'aabbccdd')).toBe(false);
  });

  it('is case-insensitive on the expected CRC', () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const buf = Buffer.concat([inesHeader(), rom]);
    const expectedCrc = computeCrc32Buffer(rom).toUpperCase();

    expect(matchesBehindInesHeader(buf, expectedCrc)).toBe(true);
  });
});
