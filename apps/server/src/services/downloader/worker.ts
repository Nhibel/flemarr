import { createWriteStream, unlink } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Crc32Accumulator } from '@/lib/crc32.js';
import { archiveFetch } from '@/services/archive-org/fetch.js';

export type WorkerResult = 'done' | 'crc-mismatch' | 'cancelled' | 'error';

export interface DownloadFileOptions {
  url: string;
  tempPath: string;
  expectedCrc: string;
  signal: AbortSignal;
  onProgress?: (bytesDownloaded: number, totalBytes: number) => void;
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
  const { url, tempPath, expectedCrc, signal, onProgress } = opts;

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

  const actualCrc = acc.digest();
  if (actualCrc !== expectedCrc.toLowerCase()) {
    await deleteFile(tempPath);
    return 'crc-mismatch';
  }

  return 'done';
}
