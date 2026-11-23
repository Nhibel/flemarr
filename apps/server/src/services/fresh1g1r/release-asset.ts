import { logger } from '@/lib/logger.js';
import { GithubStatusError, readRange, requestRelease } from './release-request.js';
import {
  entryReadLength,
  extractEntry,
  extractEntryStart,
  locateDirectory,
  parseDirectory,
} from './zip-index.js';
import type { ZipEntry } from './zip-index.js';

// Fresh1G1R publishes its DATs as ZIP assets of a daily release (since
// 2026-11-21; they used to be files of the repository). The archives reach
// 77 MB, so only the directory and the wanted entry are read, by byte range.
const RELEASES_URL = 'https://github.com/UnluckyForSome/Fresh1G1R/releases';
const PINNED_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/([^/]+)\//;

const MAX_REDIRECTS = 3;
const TAIL_BYTES = 64 * 1024;
const INDEX_TTL_MS = 10 * 60 * 1000;
const ENTRY_TIMEOUT_MS = 120_000;

interface AssetIndex {
  release: string;
  /** The asset in one given release: reads never mix two releases. */
  url: string;
  size: number;
  entries: ZipEntry[];
  readAt: number;
}

const indexes = new Map<string, AssetIndex>();

export function forgetAssetIndexes(): void {
  indexes.clear();
}

/** The asset's URL in the latest release, and that release's tag. */
async function pinLatest(asset: string): Promise<{ release: string; url: string }> {
  let url = `${RELEASES_URL}/latest/download/${asset}`;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    const request = { asset, url, method: 'HEAD', redirect: 'manual' } as const;
    const location = await requestRelease(request, async (res) => res.headers.get('location'));
    if (location === null) break;
    url = new URL(location, url).toString();
    const release = PINNED_URL_PATTERN.exec(url)?.[1];
    if (release !== undefined) return { release, url };
    // A renamed repository redirects within github.com first.
    if (!url.startsWith('https://github.com/')) break;
  }
  throw new Error(`No release found for ${asset}`);
}

async function assetSize(asset: string, url: string): Promise<number> {
  const length = await requestRelease({ asset, url, method: 'HEAD' }, async (res) =>
    Number(res.headers.get('content-length')),
  );
  if (!Number.isInteger(length) || length <= 0) throw new Error(`Unknown size for ${asset}`);
  return length;
}

async function readEntries(asset: string, url: string, size: number): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, size - TAIL_BYTES);
  const tail = await readRange(asset, url, tailStart, size);
  const { offset, size: directorySize, entryCount } = locateDirectory(tail);
  const end = offset + directorySize;
  const isInTail = offset >= tailStart;
  const directory = isInTail
    ? tail.subarray(offset - tailStart, end - tailStart)
    : await readRange(asset, url, offset, end);
  return parseDirectory(directory, entryCount);
}

async function readIndex(asset: string): Promise<AssetIndex> {
  const start = Date.now();
  const { release, url } = await pinLatest(asset);
  const size = await assetSize(asset, url);
  const entries = await readEntries(asset, url, size);
  logger.info(
    { asset, release, entries: entries.length, ms: Date.now() - start },
    'Fresh1G1R release index read',
  );
  return { release, url, size, entries, readAt: Date.now() };
}

async function getIndex(asset: string): Promise<AssetIndex> {
  const known = indexes.get(asset);
  if (known !== undefined && Date.now() - known.readAt < INDEX_TTL_MS) return known;
  const index = await readIndex(asset);
  indexes.set(asset, index);
  return index;
}

export async function listEntries(asset: string): Promise<ZipEntry[]> {
  return (await getIndex(asset)).entries;
}

interface EntryBytes {
  entry: ZipEntry;
  /** From the entry's local header on. */
  bytes: Buffer;
}

async function readFromIndex(asset: string, name: string, maxData: number): Promise<EntryBytes> {
  const index = await getIndex(asset);
  const entry = index.entries.find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`${name} is not in ${asset} (${index.release})`);
  const dataLength = Math.min(entry.compressedSize, maxData);
  const start = entry.localHeaderOffset;
  const end = Math.min(index.size, start + entryReadLength(entry, dataLength));
  return { entry, bytes: await readRange(asset, index.url, start, end, ENTRY_TIMEOUT_MS) };
}

// Upstream keeps its last 7 releases only: a 404 on a known one means the
// index is stale, so the latest release is looked up once more.
async function readEntryBytes(asset: string, name: string, maxData: number): Promise<EntryBytes> {
  try {
    return await readFromIndex(asset, name, maxData);
  } catch (err) {
    const isNotFound = err instanceof GithubStatusError && err.status === 404;
    if (!isNotFound || !indexes.delete(asset)) throw err;
    logger.warn({ asset }, 'Fresh1G1R release gone, reading the latest one');
    return readFromIndex(asset, name, maxData);
  }
}

export async function readEntry(
  asset: string,
  name: string,
): Promise<{ entry: ZipEntry; content: Buffer }> {
  const { entry, bytes } = await readEntryBytes(asset, name, Number.MAX_SAFE_INTEGER);
  return { entry, content: extractEntry(bytes, entry) };
}

/** The start of an entry, from its first `dataLength` compressed bytes. */
export async function readEntryStart(
  asset: string,
  name: string,
  dataLength: number,
): Promise<Buffer> {
  const { entry, bytes } = await readEntryBytes(asset, name, dataLength);
  return extractEntryStart(bytes, entry);
}
