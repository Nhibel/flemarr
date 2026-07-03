import { createWriteStream, unlink } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { unzipSync } from 'fflate';
import { Crc32Accumulator, computeCrc32Buffer } from '@/lib/crc32.js';
import { archiveFetch } from '@/services/archive-org/fetch.js';

export type WorkerResult = 'done' | 'crc-mismatch' | 'cancelled' | 'error';

export interface DownloadFileOptions {
  url: string;
  tempPath: string;
  expectedCrc: string;
  signal: AbortSignal;
  // The fetched file is a ZIP wrapping the ROM — extract the single entry and
  // validate its CRC instead of the ZIP's own bytes.
  extractFromZip?: boolean;
  onProgress?: (bytesDownloaded: number, totalBytes: number) => void;
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
  } catch {
    await deleteFile(tempPath);
    throw new Error('failed to extract downloaded ZIP');
  }

  if (!rom) {
    await deleteFile(tempPath);
    return 'crc-mismatch';
  }
  const romBuf = Buffer.from(rom);
  if (computeCrc32Buffer(romBuf) !== expectedCrc.toLowerCase()) {
    await deleteFile(tempPath);
    return 'crc-mismatch';
  }
  await writeFile(tempPath, romBuf);
  return 'done';
}

async function deleteFile(path: string): Promise<void> {
  await new Promise<void>((resolve) => unlink(path, () => resolve()));
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

export async function downloadFile(opts: DownloadFileOptions): Promise<WorkerResult> {
  const { url, tempPath, expectedCrc, signal, onProgress, extractFromZip } = opts;

  await mkdir(dirname(tempPath), { recursive: true });

  let res: Response;
  let attempt = 0;
  for (;;) {
    try {
      res = await archiveFetch(url, { signal });
    } catch (err) {
      if (signal.aborted) return 'cancelled';
      throw err;
    }

    if (!RETRYABLE_STATUS.has(res.status) || attempt >= MAX_RETRIES) break;

    const retryAfter = res.headers.get('retry-after');
    const waitSeconds =
      retryAfter !== null && Number.isFinite(Number(retryAfter))
        ? Math.min(Number(retryAfter), MAX_RETRY_WAIT_S)
        : (attempt + 1) * 5;
    try {
      await abortableSleep(waitSeconds * 1000, signal);
    } catch {
      return 'cancelled';
    }
    attempt++;
  }

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

  const totalBytes = Number(res.headers.get('content-length') ?? 0);
  const acc = new Crc32Accumulator();
  let bytesDownloaded = 0;

  const writer = createWriteStream(tempPath);

  try {
    const reader = res.body.getReader();

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

  // The streamed bytes are a ZIP wrapper — validate the ROM inside it instead.
  if (extractFromZip) {
    return extractAndValidate(tempPath, expectedCrc);
  }

  const actualCrc = acc.digest();
  if (actualCrc !== expectedCrc.toLowerCase()) {
    await deleteFile(tempPath);
    return 'crc-mismatch';
  }

  return 'done';
}
