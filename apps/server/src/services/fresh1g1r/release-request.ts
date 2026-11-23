import { logger } from '@/lib/logger.js';
import { loggedFetch, networkErrorReason } from '@/lib/logged-fetch.js';

const HEADERS = { 'User-Agent': 'flemarr/1.0' };
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [500, 2000];
const DEFAULT_TIMEOUT_MS = 30_000;

/** An error answer from GitHub. */
export class GithubStatusError extends Error {
  constructor(
    readonly status: number,
    asset: string,
  ) {
    super(`GitHub returned ${status} for ${asset}`);
    this.name = 'GithubStatusError';
  }
}

export interface ReleaseRequest {
  asset: string;
  url: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  redirect?: 'manual' | 'follow';
  timeoutMs?: number;
}

async function attemptRequest<T>(
  { asset, url, headers, timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: ReleaseRequest,
  read: (res: Response) => Promise<T>,
): Promise<T> {
  const res = await loggedFetch(url, {
    ...init,
    headers: { ...HEADERS, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status >= 400) {
    await res.body?.cancel();
    throw new GithubStatusError(res.status, asset);
  }
  return read(res);
}

function isRetryable(err: unknown): boolean {
  if (err instanceof GithubStatusError) return RETRYABLE_STATUS.has(err.status);
  return true; // network failure or timeout
}

function describe(err: unknown, asset: string): Error {
  if (err instanceof GithubStatusError) return err;
  return new Error(`GitHub request failed for ${asset}: ${networkErrorReason(err)}`, {
    cause: err,
  });
}

/**
 * Asks GitHub and reads the answer, retrying gateway errors and network
 * failures — including a connection lost while `read` consumes the body.
 */
export async function requestRelease<T>(
  request: ReleaseRequest,
  read: (res: Response) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptRequest(request, read);
    } catch (err) {
      const delayMs = RETRY_DELAYS_MS[attempt];
      const failure = describe(err, request.asset);
      if (!isRetryable(err) || delayMs === undefined) throw failure;
      logger.warn(
        { asset: request.asset, attempt: attempt + 1, reason: failure.message, delayMs },
        'retrying GitHub request',
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** Bytes `start` (included) to `end` (excluded) of a release asset. */
export async function readRange(
  asset: string,
  url: string,
  start: number,
  end: number,
  timeoutMs?: number,
): Promise<Buffer> {
  // Explicit bounds: GitHub's storage answers 501 to a suffix range (bytes=-N).
  const headers = { Range: `bytes=${start}-${end - 1}` };
  const bytes = await requestRelease({ asset, url, headers, timeoutMs }, async (res) => {
    if (res.status === 206) return Buffer.from(await res.arrayBuffer());
    // A 200 is the whole archive: drop it rather than read tens of MB.
    await res.body?.cancel();
    return null;
  });
  if (bytes === null) throw new Error(`Byte ranges are not served for ${asset}`);
  return bytes;
}
