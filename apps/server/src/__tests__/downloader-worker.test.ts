import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync } from 'fflate';
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

  it('strips a 16-byte iNES header and succeeds when the remainder matches', async () => {
    const rom = Buffer.from('the actual prg+chr rom bytes');
    const inesHeader = Buffer.concat([Buffer.from([0x4e, 0x45, 0x53, 0x1a]), Buffer.alloc(12)]);
    const headered = Buffer.concat([inesHeader, rom]);
    const expectedCrc = computeCrc32Buffer(rom); // DAT expects the headerless CRC
    const tempPath = join(TMP, 'headered.rom.tmp');

    mockFetchOk(headered);

    const result = await downloadFile({
      url: 'https://example.com/headered.nes',
      tempPath,
      expectedCrc,
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('done');
    const written = await readFile(tempPath);
    expect(written.equals(rom)).toBe(true);
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

describe('downloadFile — rate limiting', () => {
  function make429() {
    return {
      ok: false,
      status: 429,
      headers: { get: (h: string) => (h === 'retry-after' ? '0' : null) },
      body: null,
    };
  }

  it('retries on 429 and succeeds when the server recovers', async () => {
    const content = Buffer.from('rate limited rom');
    const crc = computeCrc32Buffer(content);
    const tempPath = join(TMP, 'retry.rom.tmp');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(make429())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === 'content-length' ? String(content.length) : null) },
        body: makeReadableStream([content]),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadFile({
      url: 'https://example.com/retry.rom',
      tempPath,
      expectedCrc: crc,
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('done');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after repeated 429s', async () => {
    const fetchMock = vi.fn().mockResolvedValue(make429());
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      downloadFile({
        url: 'https://example.com/throttled.rom',
        tempPath: join(TMP, 'throttled.rom.tmp'),
        expectedCrc: 'aabbccdd',
        signal: AbortSignal.timeout(5000),
      }),
    ).rejects.toThrow('HTTP 429');
    // initial attempt + 2 retries
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('downloadFile — extractFromZip (nested-zip collections)', () => {
  // A raw ROM wrapped in a ZIP, like ni-roms stores it
  const ROM = Buffer.from('the actual super mario world rom bytes');
  const ROM_CRC = computeCrc32Buffer(ROM);
  const ZIP = Buffer.from(zipSync({ 'Super Mario World (USA).sfc': new Uint8Array(ROM) }));

  it('extracts the inner ROM and writes it raw when its CRC matches', async () => {
    const tempPath = join(TMP, 'wrapped.tmp');
    mockFetchOk(ZIP);

    const result = await downloadFile({
      url: 'https://ia800000.us.archive.org/view_archive.php?x=1',
      tempPath,
      expectedCrc: ROM_CRC,
      extractFromZip: true,
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('done');
    // The temp file now holds the raw ROM, not the ZIP
    const written = await readFile(tempPath);
    expect(computeCrc32Buffer(written)).toBe(ROM_CRC);
    expect(written.equals(ROM)).toBe(true);
  });

  it('returns crc-mismatch when the extracted ROM has the wrong CRC', async () => {
    const tempPath = join(TMP, 'wrapped-bad.tmp');
    mockFetchOk(ZIP);

    const result = await downloadFile({
      url: 'https://ia800000.us.archive.org/view_archive.php?x=1',
      tempPath,
      expectedCrc: 'ffffffff',
      extractFromZip: true,
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('crc-mismatch');
    await expect(access(tempPath)).rejects.toThrow();
  });

  it('strips a 16-byte iNES header from an extracted ZIP entry when the remainder matches', async () => {
    const tempPath = join(TMP, 'wrapped-headered.tmp');
    const inesHeader = Buffer.concat([Buffer.from([0x4e, 0x45, 0x53, 0x1a]), Buffer.alloc(12)]);
    const headeredRom = Buffer.concat([inesHeader, ROM]);
    const zip = Buffer.from(zipSync({ 'Tetris (USA).nes': new Uint8Array(headeredRom) }));
    mockFetchOk(zip);

    const result = await downloadFile({
      url: 'https://ia800000.us.archive.org/view_archive.php?x=1',
      tempPath,
      expectedCrc: ROM_CRC, // the Headerless DAT's expected CRC — no header
      extractFromZip: true,
      signal: AbortSignal.timeout(5000),
    });

    expect(result).toBe('done');
    const written = await readFile(tempPath);
    expect(written.equals(ROM)).toBe(true);
  });

  it('throws when the downloaded bytes are not a valid ZIP', async () => {
    const tempPath = join(TMP, 'not-a-zip.tmp');
    mockFetchOk(Buffer.from('this is not a zip file'));

    await expect(
      downloadFile({
        url: 'https://ia800000.us.archive.org/view_archive.php?x=1',
        tempPath,
        expectedCrc: ROM_CRC,
        extractFromZip: true,
        signal: AbortSignal.timeout(5000),
      }),
    ).rejects.toThrow('extract');
  });
});
