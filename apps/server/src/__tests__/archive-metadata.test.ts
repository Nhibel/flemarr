import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIndex, resolveDownloadUrl, clearCache } from '../services/archive-org/metadata.js';

const MOCK_FILES = [
  { name: 'Super Mario World (USA).sfc', size: 524288, crc32: 'b19ed489', format: 'Super NES ROM' },
  { name: 'No-Intro SNES.zip', size: 999999999, format: 'ZIP' },
];

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

beforeEach(() => {
  clearCache();
  vi.restoreAllMocks();
});

describe('getIndex', () => {
  it('returns parsed file list from archive.org metadata', async () => {
    mockFetch({ files: MOCK_FILES });
    const files = await getIndex('test-identifier');
    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({
      name: 'Super Mario World (USA).sfc',
      size: 524288,
      crc32: 'b19ed489',
      format: 'Super NES ROM',
    });
  });

  it('caches the result and does not refetch', async () => {
    mockFetch({ files: MOCK_FILES });
    await getIndex('cached-id');
    await getIndex('cached-id');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('throws when archive.org returns a non-ok status', async () => {
    mockFetch({}, 404);
    await expect(getIndex('missing-id')).rejects.toThrow('archive.org metadata fetch failed: 404');
  });

  it('throws when the response shape is unexpected', async () => {
    mockFetch({ wrong: 'shape' });
    await expect(getIndex('bad-shape')).rejects.toThrow('Unexpected metadata shape');
  });

  it('handles missing size gracefully (defaults to 0)', async () => {
    mockFetch({ files: [{ name: 'game.rom', crc32: 'aabbccdd' }] });
    const files = await getIndex('no-size');
    expect(files[0]?.size).toBe(0);
  });
});

describe('resolveDownloadUrl', () => {
  it('returns a direct URL for Pattern A', () => {
    const url = resolveDownloadUrl('my-collection', 'Super Mario World (USA).sfc');
    expect(url).toBe(
      'https://archive.org/download/my-collection/Super%20Mario%20World%20(USA).sfc',
    );
  });

  it('returns a zip-entry URL for Pattern B', () => {
    const url = resolveDownloadUrl(
      'my-collection',
      'Super Mario World (USA).sfc',
      'No-Intro SNES.zip',
    );
    expect(url).toBe(
      'https://archive.org/download/my-collection/No-Intro%20SNES.zip/Super%20Mario%20World%20(USA).sfc',
    );
  });

  it('encodes special characters in identifier', () => {
    const url = resolveDownloadUrl('my collection/v2', 'game.rom');
    expect(url).toContain('my%20collection%2Fv2');
  });

  it('keeps path separators in zip/file paths (subdirectory items)', () => {
    const url = resolveDownloadUrl(
      'proper1g1r-collection',
      'Super Mario World (USA).sfc',
      'ROMs/Nintendo - Super Nintendo Entertainment System.zip',
    );
    expect(url).toBe(
      'https://archive.org/download/proper1g1r-collection/ROMs/Nintendo%20-%20Super%20Nintendo%20Entertainment%20System.zip/Super%20Mario%20World%20(USA).sfc',
    );
  });
});
