import { inflateRawSync, constants } from 'node:zlib';
import { computeCrc32Buffer } from '@/lib/crc32.js';

// The parts of the ZIP format needed to read single entries out of a remote
// archive by byte range, without downloading the archive.
const END_RECORD_SIGNATURE = Buffer.from('504b0506', 'hex');
const END_RECORD_SIZE = 22;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_SIZE = 30;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

// The local header repeats the name, then an "extra" field whose length only
// the header itself gives: this much room is read for it.
const EXTRA_FIELD_ROOM = 1024;

const MAX_DAT_BYTES = 256 * 1024 * 1024;

export interface ZipEntry {
  name: string;
  crc32: string;
  compressedSize: number;
  size: number;
  method: number;
  localHeaderOffset: number;
}

export interface ZipDirectoryLocation {
  offset: number;
  size: number;
  entryCount: number;
}

/** Where the central directory is, read from the last bytes of the archive. */
export function locateDirectory(tail: Buffer): ZipDirectoryLocation {
  const start = tail.lastIndexOf(END_RECORD_SIGNATURE);
  if (start === -1 || start + END_RECORD_SIZE > tail.length) {
    throw new Error('Not a ZIP archive: end record not found');
  }
  const entryCount = tail.readUInt16LE(start + 10);
  const size = tail.readUInt32LE(start + 12);
  const offset = tail.readUInt32LE(start + 16);
  const isZip64 =
    entryCount === ZIP64_MARKER_16 || size === ZIP64_MARKER_32 || offset === ZIP64_MARKER_32;
  if (isZip64) throw new Error('ZIP64 archives are not supported');
  return { offset, size, entryCount };
}

function assertPlainName(name: string): void {
  if (name.includes('/') || name.includes('\\')) {
    throw new Error(`Unexpected path in ZIP archive: ${name}`);
  }
}

/** The entries of a central directory. */
export function parseDirectory(directory: Buffer, entryCount: number): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let position = 0;
  for (let index = 0; index < entryCount; index++) {
    const isTruncated = position + CENTRAL_HEADER_SIZE > directory.length;
    if (isTruncated || directory.readUInt32LE(position) !== CENTRAL_SIGNATURE) {
      throw new Error('Corrupt ZIP archive: bad central directory');
    }
    const nameLength = directory.readUInt16LE(position + 28);
    const extraLength = directory.readUInt16LE(position + 30);
    const commentLength = directory.readUInt16LE(position + 32);
    const nameStart = position + CENTRAL_HEADER_SIZE;
    const name = directory.toString('utf8', nameStart, nameStart + nameLength);
    assertPlainName(name);
    entries.push({
      name,
      method: directory.readUInt16LE(position + 10),
      crc32: directory
        .readUInt32LE(position + 16)
        .toString(16)
        .padStart(8, '0'),
      compressedSize: directory.readUInt32LE(position + 20),
      size: directory.readUInt32LE(position + 24),
      localHeaderOffset: directory.readUInt32LE(position + 42),
    });
    position = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Bytes to read from the entry's local header to hold `dataLength` bytes of its data. */
export function entryReadLength(entry: ZipEntry, dataLength: number): number {
  return LOCAL_HEADER_SIZE + Buffer.byteLength(entry.name) + EXTRA_FIELD_ROOM + dataLength;
}

// The entry's data, as much of it as `bytes` holds.
function entryData(bytes: Buffer, entry: ZipEntry): Buffer {
  if (bytes.length < LOCAL_HEADER_SIZE || bytes.readUInt32LE(0) !== LOCAL_SIGNATURE) {
    throw new Error(`Corrupt ZIP archive: bad local header for ${entry.name}`);
  }
  const start = LOCAL_HEADER_SIZE + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
  return bytes.subarray(start, start + entry.compressedSize);
}

function assertSupportedMethod(entry: ZipEntry): void {
  if (entry.method !== METHOD_STORED && entry.method !== METHOD_DEFLATED) {
    throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}`);
  }
}

/** The whole entry, checked against its CRC. `bytes` starts at its local header. */
export function extractEntry(bytes: Buffer, entry: ZipEntry): Buffer {
  assertSupportedMethod(entry);
  if (entry.size > MAX_DAT_BYTES) throw new Error(`ZIP entry too large: ${entry.name}`);
  const data = entryData(bytes, entry);
  if (data.length < entry.compressedSize) throw new Error(`Truncated ZIP entry: ${entry.name}`);
  const content =
    entry.method === METHOD_STORED
      ? data
      : inflateRawSync(data, { maxOutputLength: Math.max(entry.size, 1) });
  if (computeCrc32Buffer(content) !== entry.crc32) {
    throw new Error(`CRC mismatch in ZIP entry: ${entry.name}`);
  }
  return content;
}

/** The start of an entry, from the start of its compressed data. */
export function extractEntryStart(bytes: Buffer, entry: ZipEntry): Buffer {
  assertSupportedMethod(entry);
  const data = entryData(bytes, entry);
  if (entry.method === METHOD_STORED) return data;
  // Z_SYNC_FLUSH accepts a stream cut short instead of calling it corrupt.
  return inflateRawSync(data, { finishFlush: constants.Z_SYNC_FLUSH });
}
