import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { downloadFile } from '../services/downloader/worker.js';

const TMP = join(tmpdir(), 'rom-curator-worker-test');

beforeEach(async () => {
  await mkdir(TMP, { recursive: true });
  vi.restoreAllMocks();
});

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true });
});

function makeReadableStream(chunks: Buffer[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
}

function mockFetchOk(body: Buffer, contentLength = true) {
  const chunks = [body];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h === 'content-length' && contentLength ? String(body.length) : null),
      },
      body: makeReadableStream(chunks),
    }),
  );
}

function mockFetchStatus(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, status, headers: { get: () => null }, body: null }),
  );
}

describe('downloadFile', () => {
  it('downloads a file and validates CRC correctly', async () => {
    const content = Buffer.from('hello rom');
    const crc = computeCrc32Buffer(content);
    const tempPath = join(TMP, 'game.rom.tmp');

    mockFetchOk(content);

    const result = await downloadFile({
      url: 'https://example.com/game.rom',
      tempPath,
      expectedCrc: crc,
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('done');
    // temp file should still exist after 'done' — caller renames it
    await expect(access(tempPath)).resolves.toBeUndefined();
  });

  it('returns crc-mismatch and deletes temp file when CRC is wrong', async () => {
    const content = Buffer.from('corrupted data');
    const tempPath = join(TMP, 'bad.rom.tmp');

    mockFetchOk(content);

    const result = await downloadFile({
      url: 'https://example.com/bad.rom',
      tempPath,
      expectedCrc: 'deadbeef', // wrong CRC
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('crc-mismatch');
    await expect(access(tempPath)).rejects.toThrow();
  });

  it('returns cancelled and deletes temp file when signal is aborted', async () => {
    const tempPath = join(TMP, 'cancelled.rom.tmp');
    const controller = new AbortController();

    // Abort immediately
    controller.abort();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));

    const result = await downloadFile({
      url: 'https://example.com/game.rom',
      tempPath,
      expectedCrc: 'deadbeef',
      signal: controller.signal,
    });

    expect(result).toBe('cancelled');
  });

  it('throws on non-ok HTTP status', async () => {
    const tempPath = join(TMP, 'err.rom.tmp');
    mockFetchStatus(404);

    await expect(
      downloadFile({
        url: 'https://example.com/missing.rom',
        tempPath,
        expectedCrc: 'deadbeef',
        signal: AbortSignal.timeout(5000),
      }),
    ).rejects.toThrow('HTTP 404');
  });

  it('reports progress via onProgress callback', async () => {
    const content = Buffer.from('hello rom');
    const crc = computeCrc32Buffer(content);
    const tempPath = join(TMP, 'progress.rom.tmp');
    const calls: [number, number][] = [];

    mockFetchOk(content);

    await downloadFile({
      url: 'https://example.com/game.rom',
      tempPath,
      expectedCrc: crc,
      signal: AbortSignal.timeout(5000),
      onProgress: (dl, total) => calls.push([dl, total]),
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]?.[0]).toBe(content.length);
  });

  it('creates intermediate directories if they do not exist', async () => {
    const content = Buffer.from('hi');
    const crc = computeCrc32Buffer(content);
    const tempPath = join(TMP, 'deep', 'nested', 'game.tmp');

    mockFetchOk(content);

    const result = await downloadFile({
      url: 'https://example.com/game.rom',
      tempPath,
      expectedCrc: crc,
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('done');
  });
});
