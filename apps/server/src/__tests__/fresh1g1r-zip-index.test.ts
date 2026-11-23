import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  entryReadLength,
  extractEntry,
  extractEntryStart,
  locateDirectory,
  parseDirectory,
} from '../services/fresh1g1r/zip-index.js';
import type { ZipEntry } from '../services/fresh1g1r/zip-index.js';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { zipOf } from './helpers/fake-releases.js';

// Varied enough that deflate cannot shrink it to nothing.
const LONG_TEXT = Array.from({ length: 20_000 }, (_, i) => `line ${i * 7919}`).join('\n');

function read(zip: Uint8Array): { bytes: Buffer; entries: ZipEntry[] } {
  const bytes = Buffer.from(zip);
  const { offset, size, entryCount } = locateDirectory(bytes);
  return { bytes, entries: parseDirectory(bytes.subarray(offset, offset + size), entryCount) };
}

function only(zip: Uint8Array): { bytes: Buffer; entry: ZipEntry } {
  const { bytes, entries } = read(zip);
  const entry = entries[0]!;
  return { bytes: bytes.subarray(entry.localHeaderOffset), entry };
}

describe('parseDirectory', () => {
  it('lists every entry with its CRC and size', () => {
    const { entries } = read(zipOf({ 'a.dat': 'hello', 'é.dat': 'world!' }));
    expect(entries.map((e) => [e.name, e.size, e.crc32])).toEqual([
      ['a.dat', 5, computeCrc32Buffer(Buffer.from('hello'))],
      ['é.dat', 6, computeCrc32Buffer(Buffer.from('world!'))],
    ]);
  });

  it('refuses a name that is a path', () => {
    expect(() => read(zipOf({ '../evil.dat': 'x' }))).toThrow('Unexpected path');
  });

  it('refuses a truncated directory', () => {
    const bytes = Buffer.from(zipOf({ 'a.dat': 'hello' }));
    const { offset } = locateDirectory(bytes);
    expect(() => parseDirectory(bytes.subarray(offset, offset + 10), 1)).toThrow('Corrupt');
  });
});

describe('locateDirectory', () => {
  it('refuses bytes that are not the end of a ZIP', () => {
    expect(() => locateDirectory(Buffer.from('<html>'))).toThrow('Not a ZIP');
  });
});

describe('extractEntry', () => {
  it.each([0, 9] as const)('reads an entry back at compression level %i', (level) => {
    const { bytes, entry } = only(zipSync({ 'a.dat': strToU8(LONG_TEXT) }, { level }));
    expect(extractEntry(bytes, entry).toString()).toBe(LONG_TEXT);
  });

  it('refuses content that does not match its CRC', () => {
    const { bytes, entry } = only(zipOf({ 'a.dat': LONG_TEXT }));
    expect(() => extractEntry(bytes, { ...entry, crc32: '00000000' })).toThrow('CRC mismatch');
  });

  it('refuses a truncated entry', () => {
    const { bytes, entry } = only(zipOf({ 'a.dat': LONG_TEXT }));
    expect(() => extractEntry(bytes.subarray(0, 500), entry)).toThrow('Truncated');
  });

  it('refuses content larger than announced', () => {
    const { bytes, entry } = only(zipOf({ 'a.dat': LONG_TEXT }));
    expect(() => extractEntry(bytes, { ...entry, size: 10 })).toThrow();
  });
});

describe('extractEntryStart', () => {
  it('reads the start of an entry from part of its data', () => {
    const { bytes, entry } = only(zipOf({ 'a.dat': LONG_TEXT }));
    const part = bytes.subarray(0, entryReadLength(entry, 4096));
    const start = extractEntryStart(part, entry).toString();
    expect(start.length).toBeGreaterThan(1000);
    expect(LONG_TEXT.startsWith(start)).toBe(true);
  });
});
