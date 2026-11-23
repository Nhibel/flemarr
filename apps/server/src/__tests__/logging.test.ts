import { describe, it, expect, vi, afterEach } from 'vitest';
import { pino } from 'pino';
import { app } from '../app.js';
import { logger, loggerOptions, resolveLogLevel } from '../lib/logger.js';
import { loggedFetch, networkErrorReason } from '../lib/logged-fetch.js';
import { runWithRequestId } from '../lib/request-context.js';

function capture() {
  const lines: string[] = [];
  const log = pino(loggerOptions('debug'), { write: (line: string) => lines.push(line) });
  return { log, lines };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('logger', () => {
  it.each([
    ['DEBUG', 'debug'],
    ['silent', 'silent'],
    ['verbose', 'info'],
  ])('reads LOG_LEVEL=%s as %s', (requested, expected) => {
    expect(resolveLogLevel(requested)).toBe(expected);
  });

  it('writes a readable level and time', () => {
    const { log, lines } = capture();
    log.info('hello');
    const line = JSON.parse(lines[0]!) as { level: string; time: string };
    expect(line.level).toBe('info');
    expect(line.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('adds the request id, also to work that outlives the request', async () => {
    const { log, lines } = capture();
    let background: Promise<void> = Promise.resolve();
    runWithRequestId('req-1', () => {
      background = new Promise<void>((resolve) => setTimeout(resolve, 5)).then(() => {
        log.info('later');
      });
    });
    await background;
    expect(JSON.parse(lines[0]!)).toMatchObject({ requestId: 'req-1' });
  });

  it('hides secrets', () => {
    const { log, lines } = capture();
    log.info({ password: 'hunter2', headers: { Cookie: 'sig=hunter2' } }, 'x');
    expect(lines[0]).not.toContain('hunter2');
  });
});

describe('error responses', () => {
  it('are logged with their code, and carry the request id', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const res = await app.request('/api/dat-sources?preset=Nope');
    expect(res.status).toBe(400);
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_PRESET', status: 400 }),
      'error response',
    );
  });
});

describe('loggedFetch', () => {
  it('never logs the query string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const warn = vi.spyOn(logger, 'warn');
    await loggedFetch('https://example.org/file.zip?sig=secret');
    expect(JSON.stringify(warn.mock.calls)).toContain('example.org/file.zip');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
  });

  it('logs why the network failed', async () => {
    const cause = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
    const failure = new TypeError('fetch failed', { cause });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    const warn = vi.spyOn(logger, 'warn');
    await expect(loggedFetch('https://example.org/')).rejects.toBe(failure);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: networkErrorReason(failure) }),
      'external request failed',
    );
    expect(networkErrorReason(failure)).toContain('ECONNREFUSED');
  });
});
