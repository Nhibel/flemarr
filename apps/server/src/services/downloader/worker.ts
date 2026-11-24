import { createWriteStream, unlink } from 'node:fs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { unzipSync } from 'fflate';
import { Crc32Accumulator, computeCrc32Buffer } from '@/lib/crc32.js';
import { matchesBehindInesHeader } from '@/lib/ines-header.js';
import { logger } from '@/lib/logger.js';
import { logTarget } from '@/lib/logged-fetch.js';
import { archiveFetch } from '@/services/archive-org/fetch.js';

export type WorkerResult = 'done' | 'crc-mismatch' | 'cancelled' | 'error';

export interface DownloadFileOptions {
  url: string;
  tempPath: string;
  // Omitted for a plain whole-file fetch with no hash to check yet (the
  // archive-container fast path: the container's own bytes are never the
  // ROM's bytes, so there's nothing meaningful to compare here — the actual
  // ROM is extracted and CRC-checked afterward by extractContainerEntry).
  expectedCrc?: string;
  signal: AbortSignal;
  // The fetched file is a ZIP wrapping the ROM — extract the single entry and
  // validate its CRC instead of the ZIP's own bytes.
  extractFromZip?: boolean;
  onProgress?: (bytesDownloaded: number, totalBytes: number) => void;
}

/** The DAT may list an NES game without the iNES header its file carries. */
function isExpectedRom(rom: Buffer, expectedCrc: string): boolean {
  return (
    computeCrc32Buffer(rom) === expectedCrc.toLowerCase() ||
    matchesBehindInesHeader(rom, expectedCrc)
  );
}

// Open the downloaded ZIP, extract its single entry, and replace the temp file
// with the raw ROM if its CRC matches. Returns the WorkerResult.
async function extractAndValidate(tempPath: string, expectedCrc: string): Promise<WorkerResult> {
  let rom: Uint8Array | undefined;
  try {
    const zipBytes = await readFile(tempPath);
    const entries = unzipSync(new Uint8Array(zipBytes));
    // TorrentZipped ROMs hold exactly one file; if several, prefer a CRC match.
    const values = Object.values(entries);
    rom =
      values.find((b) => computeCrc32Buffer(Buffer.from(b)) === expectedCrc.toLowerCase()) ??
      values[0];
  } catch (err) {
    logger.warn({ tempPath, err }, 'downloaded ZIP unreadable');
    await deleteFile(tempPath);
    throw new Error('failed to extract downloaded ZIP');
  }

  if (!rom) {
    await deleteFile(tempPath);
    return 'crc-mismatch';
  }
  const romBuf = Buffer.from(rom);
  if (isExpectedRom(romBuf, expectedCrc)) {
    await writeFile(tempPath, romBuf);
    return 'done';
  }
  logger.warn({ tempPath, expectedCrc, foundCrc: computeCrc32Buffer(romBuf) }, 'CRC mismatch');
  await deleteFile(tempPath);
  return 'crc-mismatch';
}

async function deleteFile(path: string): Promise<void> {
  await new Promise<void>((resolve) => unlink(path, () => resolve()));
}

// Minimal shape of the 7z-wasm module we actually use — its own .d.ts
// targets plain ESM default-import consumption and doesn't type-check
// cleanly through a NodeNext dynamic import of a CJS/UMD package, so it's
// loaded via createRequire below (the same runtime value either way: the
// package sets both `module.exports` and `module.exports.default` to the
// same factory function).
interface SevenZipModule {
  FS: {
    mkdir(path: string): void;
    mount(type: unknown, opts: { root: string }, mountpoint: string): void;
    chdir(path: string): void;
  };
  NODEFS: unknown;
  callMain(args: string[]): void;
}
interface SevenZipFactory {
  (opts: {
    quit: (code: number) => void;
    onExit: (code: number) => void;
    onAbort: (what: unknown) => void;
    print: (s: string) => void;
    printErr: (s: string) => void;
  }): Promise<SevenZipModule>;
}

export interface ExtractContainerEntryOptions {
  // A whole archive container already fully downloaded to disk (the
  // archive-container fast path's own fetch step — see downloader/index.ts's
  // getOrFetchContainer).
  containerPath: string;
  // The exact entry to pull out of it, as named in the DAT/resolver's match.
  innerPath: string;
  // Where the validated ROM bytes get written on success.
  outputPath: string;
  expectedCrc: string;
}

// Extracts one named entry from a whole downloaded archive container
// (.zip/.7z/.rar) and validates its CRC — the local half of the
// archive-container fast path (resolver.ts's isExactZipMatch; see
// docs/archive-org-strategy.md's "Pattern E"). 7-Zip auto-detects the actual
// format from the container's own content, so there's no format switch here.
//
// On CRC mismatch, only the bad extracted output is deleted — never
// containerPath itself, which sibling ROMs from the same archive (e.g. a
// disc's .bin and .cue) may still need; see downloader/index.ts's
// containerCache. Any extraction error (corrupt archive, missing inner
// entry, unsupported sub-format) throws, which the downloader's existing
// per-candidate try/catch already treats as "this candidate failed, try the
// next" — falling through to the source's `fallback` automatically.
export async function extractContainerEntry(
  opts: ExtractContainerEntryOptions,
): Promise<WorkerResult> {
  const { containerPath, innerPath, outputPath, expectedCrc } = opts;
  const extractDirName = `${basename(containerPath)}.extract-${randomUUID()}`;
  const extractDir = join(dirname(containerPath), extractDirName);

  // IMPORTANT: 7z-wasm's own CLI example wires `quit` to `process.exit` —
  // never do that here. This runs inside the long-lived server process, and
  // one corrupt or unsupported archive must not be able to kill it. These
  // callbacks just swallow the exit status instead of acting on it;
  // smoke-testing confirmed 7-Zip doesn't reliably call them on every
  // failure anyway (a missing inner entry reports "no files to process" via
  // onExit/quit, both uncalled) — so success/failure here is decided by
  // whether the expected output file actually exists afterward, not by any
  // exit code. callMain can also throw synchronously (sometimes a bare exit
  // code rather than an Error, confirmed by smoke-testing an unsupported
  // write operation) on a genuinely fatal condition — wrapped below too.
  const require = createRequire(import.meta.url);
  const SevenZip = require('7z-wasm') as SevenZipFactory;
  let sevenZip: SevenZipModule;
  try {
    sevenZip = await SevenZip({
      quit: () => undefined,
      onExit: () => undefined,
      onAbort: () => undefined,
      print: () => undefined,
      printErr: () => undefined,
    });

    const mountRoot = '/nodefs';
    sevenZip.FS.mkdir(mountRoot);
    sevenZip.FS.mount(sevenZip.NODEFS, { root: dirname(containerPath) }, mountRoot);
    sevenZip.FS.chdir(mountRoot);
    sevenZip.callMain(['x', basename(containerPath), innerPath, `-o${extractDirName}`, '-y']);
  } catch (err) {
    await rm(extractDir, { recursive: true, force: true }).catch(() => undefined);
    throw err instanceof Error ? err : new Error(`7z-wasm extraction failed: ${String(err)}`);
  }

  let rom: Buffer;
  try {
    rom = await readFile(join(extractDir, innerPath));
  } catch (err) {
    logger.warn({ containerPath, innerPath, err }, 'container entry not extracted');
    await rm(extractDir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(`entry not found in container: ${innerPath}`);
  }
  await rm(extractDir, { recursive: true, force: true }).catch(() => undefined);

  if (isExpectedRom(rom, expectedCrc)) {
    await writeFile(outputPath, rom);
    return 'done';
  }
  logger.warn({ innerPath, expectedCrc, foundCrc: computeCrc32Buffer(rom) }, 'CRC mismatch');
  return 'crc-mismatch';
}

// archive.org signals overload with 429/503 — back off and retry the same
// URL instead of failing the file outright.
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 2;
const MAX_RETRY_WAIT_S = 30;

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

/**
 * Seconds to wait before retrying a 429/503: the server's Retry-After when
 * it's a number (capped, so a hostile value can't stall a job), otherwise a
 * linear backoff of 5 s, 10 s…
 */
export function retryDelaySeconds(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null && Number.isFinite(Number(retryAfter))) {
    return Math.min(Number(retryAfter), MAX_RETRY_WAIT_S);
  }
  return (attempt + 1) * 5;
}

// Fetches `url`, retrying rate-limit responses up to MAX_RETRIES times. The
// last response is returned as is, ok or not — the caller decides.
async function fetchWithRetry(url: string, signal: AbortSignal): Promise<Response | 'cancelled'> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await archiveFetch(url, { signal });
    } catch (err) {
      if (signal.aborted) return 'cancelled';
      throw err;
    }

    if (!RETRYABLE_STATUS.has(res.status) || attempt >= MAX_RETRIES) return res;

    const waitSeconds = retryDelaySeconds(res.headers.get('retry-after'), attempt);
    logger.warn(
      { target: logTarget(url), status: res.status, attempt: attempt + 1, waitSeconds },
      'download rate-limited, retrying',
    );
    try {
      await abortableSleep(waitSeconds * 1000, signal);
    } catch {
      return 'cancelled';
    }
  }
}

function responseBody(res: Response, url: string): ReadableStream<Uint8Array> {
  if (!res.ok) {
    // 403 on a restricted item means the archive.org session expired — the
    // message steers the user to reconnect rather than blaming the source.
    if (res.status === 403) {
      throw new Error(
        'HTTP 403 — accès refusé (session archive.org expirée ? reconnectez-vous dans Paramètres)',
      );
    }
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  if (!res.body) {
    throw new Error(`No response body from ${url}`);
  }
  return res.body;
}

// Streams the body to tempPath, CRC-ing it on the way. Returns the CRC, or
// 'cancelled' (the partial file deleted) when the signal aborts mid-stream.
async function streamToFile(
  body: ReadableStream<Uint8Array>,
  tempPath: string,
  totalBytes: number,
  signal: AbortSignal,
  onProgress: DownloadFileOptions['onProgress'],
): Promise<string | 'cancelled'> {
  const acc = new Crc32Accumulator();
  let bytesDownloaded = 0;

  const writer = createWriteStream(tempPath);

  try {
    const reader = body.getReader();

    await new Promise<void>((resolve, reject) => {
      writer.on('error', reject);

      const pump = (): void => {
        if (signal.aborted) {
          reader.cancel().catch(() => undefined);
          writer.destroy();
          reject(new Error('aborted'));
          return;
        }

        reader.read().then(({ done, value }) => {
          if (done) {
            writer.end();
            return;
          }
          const buf = Buffer.from(value);
          acc.feed(buf);
          bytesDownloaded += buf.length;
          onProgress?.(bytesDownloaded, totalBytes);
          writer.write(buf, (err) => {
            if (err) {
              reject(err);
              return;
            }
            pump();
          });
        }, reject);
      };

      writer.on('finish', resolve);
      pump();
    });
  } catch (err) {
    await deleteFile(tempPath);
    if (signal.aborted || (err instanceof Error && err.message === 'aborted')) {
      return 'cancelled';
    }
    throw err;
  }

  return acc.digest();
}

// Checks the file now at tempPath against the DAT's CRC; deletes it on a
// mismatch.
async function checkCrc(
  tempPath: string,
  expectedCrc: string,
  streamedCrc: string,
  extractFromZip: boolean | undefined,
): Promise<WorkerResult> {
  // The streamed bytes are a ZIP wrapper — validate the ROM inside it instead.
  if (extractFromZip) {
    return extractAndValidate(tempPath, expectedCrc);
  }

  if (streamedCrc === expectedCrc.toLowerCase()) {
    return 'done';
  }

  // The streamed bytes might carry a 16-byte iNES header the DAT doesn't
  // expect (Headerless DAT, headered real-world dump) — the file is already
  // on disk, so read it back and check rather than re-downloading. The header
  // stays: several emulators refuse a file without it.
  const buf = await readFile(tempPath);
  if (matchesBehindInesHeader(buf, expectedCrc)) {
    return 'done';
  }
  logger.warn({ tempPath, expectedCrc, foundCrc: computeCrc32Buffer(buf) }, 'CRC mismatch');

  await deleteFile(tempPath);
  return 'crc-mismatch';
}

export async function downloadFile(opts: DownloadFileOptions): Promise<WorkerResult> {
  const { url, tempPath, expectedCrc, signal, onProgress, extractFromZip } = opts;

  await mkdir(dirname(tempPath), { recursive: true });

  const res = await fetchWithRetry(url, signal);
  if (res === 'cancelled') return 'cancelled';

  const body = responseBody(res, url);
  const totalBytes = Number(res.headers.get('content-length') ?? 0);
  const streamedCrc = await streamToFile(body, tempPath, totalBytes, signal, onProgress);
  if (streamedCrc === 'cancelled') return 'cancelled';

  // A plain whole-file fetch with nothing to validate yet (the
  // archive-container fast path fetches the container itself this way,
  // before extractContainerEntry pulls out and CRC-checks the actual ROM).
  if (expectedCrc === undefined) {
    return 'done';
  }

  return checkCrc(tempPath, expectedCrc, streamedCrc, extractFromZip);
}
