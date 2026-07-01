import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeCrc32, computeCrc32Buffer } from '../lib/crc32.js';

describe('computeCrc32Buffer', () => {
  it('returns 00000000 for empty buffer', () => {
    expect(computeCrc32Buffer(Buffer.alloc(0))).toBe('00000000');
  });

  it('returns known CRC32 for "123456789"', () => {
    // Standard CRC32 test vector
    expect(computeCrc32Buffer(Buffer.from('123456789'))).toBe('cbf43926');
  });

  it('returns 8 lowercase hex chars', () => {
    const result = computeCrc32Buffer(Buffer.from('hello world'));
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('computeCrc32 (file)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crc32-test-'));

  it('matches buffer result for same content', async () => {
    const content = Buffer.from('Super Mario World');
    const filePath = join(dir, 'test.rom');
    writeFileSync(filePath, content);

    const fromFile = await computeCrc32(filePath);
    const fromBuffer = computeCrc32Buffer(content);
    expect(fromFile).toBe(fromBuffer);
  });

  it('returns 00000000 for empty file', async () => {
    const filePath = join(dir, 'empty.rom');
    writeFileSync(filePath, '');
    expect(await computeCrc32(filePath)).toBe('00000000');
  });

  it('rejects on non-existent file', async () => {
    await expect(computeCrc32(join(dir, 'nope.rom'))).rejects.toThrow();
  });

  // cleanup
  it('cleanup', () => {
    rmSync(dir, { recursive: true });
  });
});
