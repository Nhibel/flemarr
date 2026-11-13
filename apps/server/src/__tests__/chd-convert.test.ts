import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { convertGameToChd } from '../services/downloader/chd.js';
import type { Rom } from '@shared/dat.js';

// Real chdman against a real tiny 2-track disc, not mocked — this exercises
// the actual createcd/extractcd round-trip, matching this session's
// precedent for other native/WASM tools (archive-extract.test.ts's 7z-wasm).
// Sector sizes matter here: MODE1/2352 and AUDIO tracks must be multiples
// of the 2352-byte raw sector size, or chdman rejects the cue outright.

const SECTOR = 2352;

let dir: string;

function sectorBuffer(fill: number, sectors: number): Buffer {
  return Buffer.alloc(SECTOR * sectors, fill);
}

async function writeDiscFixture(): Promise<{ roms: Rom[] }> {
  const track1 = sectorBuffer(1, 10);
  const track2 = sectorBuffer(2, 10);
  await writeFile(join(dir, 'Game (USA) (Track 1).bin'), track1);
  await writeFile(join(dir, 'Game (USA) (Track 2).bin'), track2);
  await writeFile(
    join(dir, 'Game (USA).cue'),
    [
      'FILE "Game (USA) (Track 1).bin" BINARY',
      '  TRACK 01 MODE1/2352',
      '    INDEX 01 00:00:00',
      'FILE "Game (USA) (Track 2).bin" BINARY',
      '  TRACK 02 AUDIO',
      '    INDEX 00 00:00:00',
      '    INDEX 01 00:02:00',
      '',
    ].join('\n'),
  );

  const roms: Rom[] = [
    {
      name: 'Game (USA) (Track 1).bin',
      size: track1.length,
      crc: computeCrc32Buffer(track1),
      status: 'good',
    },
    {
      name: 'Game (USA) (Track 2).bin',
      size: track2.length,
      crc: computeCrc32Buffer(track2),
      status: 'good',
    },
    {
      name: 'Game (USA).cue',
      size: (await readFile(join(dir, 'Game (USA).cue'))).length,
      crc: computeCrc32Buffer(await readFile(join(dir, 'Game (USA).cue'))),
      status: 'good',
    },
  ];
  return { roms };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rom-curator-chd-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('convertGameToChd', () => {
  it('converts a real 2-track disc, verifies the round-trip, and deletes the originals', async () => {
    const { roms } = await writeDiscFixture();

    const result = await convertGameToChd(dir, roms);

    expect(result.ok).toBe(true);
    await expect(access(join(dir, 'Game (USA).chd'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'Game (USA) (Track 1).bin'))).rejects.toThrow();
    await expect(access(join(dir, 'Game (USA) (Track 2).bin'))).rejects.toThrow();
    await expect(access(join(dir, 'Game (USA).cue'))).rejects.toThrow();
  });

  it('leaves the originals untouched when the expected CRC is wrong (round-trip mismatch)', async () => {
    const { roms } = await writeDiscFixture();
    const tampered = roms.map((r) =>
      r.name.endsWith('Track 1).bin') ? { ...r, crc: 'ffffffff' } : r,
    );

    const result = await convertGameToChd(dir, tampered);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/CRC mismatch/i);
    // Originals still there — a bad verify must never destroy a good download.
    await expect(access(join(dir, 'Game (USA) (Track 1).bin'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'Game (USA) (Track 2).bin'))).resolves.toBeUndefined();
    await expect(access(join(dir, 'Game (USA).cue'))).resolves.toBeUndefined();
    // No half-made .chd left behind either.
    await expect(access(join(dir, 'Game (USA).chd'))).rejects.toThrow();
  });

  it('returns ok: false without touching anything when the game has no .cue', async () => {
    const roms: Rom[] = [
      { name: 'Game (USA).sfc', size: 4, crc: '00000000', status: 'good' },
    ];

    const result = await convertGameToChd(dir, roms);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/\.cue/);
  });
});
