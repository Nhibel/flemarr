import { logger } from '@/lib/logger.js';

/** Host and path only: a query string can carry a signature or a token. */
export function logTarget(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return '(invalid URL)';
  }
}

/** The network reason behind undici's bare "fetch failed". */
export function networkErrorReason(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause: unknown = err.cause;
  if (!(cause instanceof Error)) return err.message;
  const code = 'code' in cause ? String(cause.code) : '';
  return [err.message, code, cause.message].filter((part) => part !== '').join(': ');
}

// A 404 is an ordinary answer to the existence probes (box art, HEAD checks);
// the caller reports it when it is a real failure.
function isExpectedStatus(status: number): boolean {
  return status < 400 || status === 404;
}

/** fetch() that logs target, status and duration. Never the query or the headers. */
export async function loggedFetch(url: string, init?: RequestInit): Promise<Response> {
  const start = Date.now();
  const method = init?.method ?? 'GET';
  const target = logTarget(url);
  try {
    const res = await (init === undefined ? fetch(url) : fetch(url, init));
    const level = isExpectedStatus(res.status) ? 'debug' : 'warn';
    logger[level](
      { method, target, status: res.status, ms: Date.now() - start },
      'external request',
    );
    return res;
  } catch (err) {
    const isCancelled = err instanceof Error && err.name === 'AbortError';
    const level = isCancelled ? 'debug' : 'warn';
    logger[level](
      { method, target, reason: networkErrorReason(err), ms: Date.now() - start },
      'external request failed',
    );
    throw err;
  }
}
