import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { scanFiles } from '../services/scanner/scan-files.js';
import type { ScanProgress } from '../services/scanner/scan-files.js';
import { walkDir } from '../services/scanner/walk.js';
import type { DatFile } from '@shared/dat.js';

const CARTRIDGE_BYTES = Buffer.from('a cartridge rom');

const DAT: DatFile = {
  source: 'redump',
  system: 'Sony - PlayStation',
  games: [
    {
      id: 'g1',
      name: 'Bloody Roar (USA)',
      region: ['USA'],
      languages: ['En'],
      roms: [
        { name: 'Bloody Roar (USA).cue', size: 100, crc: '11111111', status: 'good' },
        { name: 'Bloody Roar (USA) (Track 1).bin', size: 200, crc: '22222222', status: 'good' },
        { name: 'Bloody Roar (USA) (Track 2).bin', size: 300, crc: '33333333', status: 'good' },
        { name: 'Bloody Roar (USA) (Track 3).bin', size: 300, status: 'nodump' },
      ],
    },
    {
      id: 'g2',
      name: 'Cartridge (USA)',
      region: ['USA'],
      languages: ['En'],
      roms: [
        {
          name: 'Cartridge (USA).bin',
          size: CARTRIDGE_BYTES.length,
          crc: computeCrc32Buffer(CARTRIDGE_BYTES),
          status: 'good',
        },
      ],
    },
  ],
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'flemarr-scan-files-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function scan(paths: string[]): Promise<{
  result: Awaited<ReturnType<typeof scanFiles>>;
  progress: ScanProgress[];
}> {
  const progress: ScanProgress[] = [];
  const result = await scanFiles(paths, DAT, (event) => progress.push(event));
  return { result, progress };
}

describe('scanFiles — .chd', () => {
  // The bytes are not a real CHD: extracting it would fail and land it in
  // `unmatched`. Finding it matched proves the name alone identified it.
  it('identifies a .chd named after a game without extracting it', async () => {
    const chdPath = join(dir, 'Bloody Roar (USA).chd');
    await writeFile(chdPath, 'not a real chd');

    const { result, progress } = await scan([chdPath]);

    expect(result.matched.map((match) => match.romName)).toEqual([
      'Bloody Roar (USA).cue',
      'Bloody Roar (USA) (Track 1).bin',
      'Bloody Roar (USA) (Track 2).bin',
    ]);
    expect(result.matched.every((match) => match.filePath === chdPath)).toBe(true);
    expect(result.unmatched).toEqual([]);
    expect(progress.some((event) => event.extracting !== undefined)).toBe(false);
  });

  it('extracts a .chd whose name matches no game, and says so', async () => {
    const chdPath = join(dir, 'renamed.chd');
    await writeFile(chdPath, 'not a real chd');

    const { progress } = await scan([chdPath]);

    expect(progress).toContainEqual({ scanned: 0, total: 1, extracting: 'renamed.chd' });
  });

  // Before, a .chd neither path identified vanished from the result: it
  // was neither found nor reported as unknown.
  it('reports a .chd nothing identifies as unmatched', async () => {
    const chdPath = join(dir, 'renamed.chd');
    await writeFile(chdPath, 'not a real chd');

    const { result } = await scan([chdPath]);

    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([chdPath]);
  });
});

describe('scanFiles — progress', () => {
  it('reports the total before hashing anything', async () => {
    const romPath = join(dir, 'Cartridge (USA).bin');
    await writeFile(romPath, CARTRIDGE_BYTES);

    const { result, progress } = await scan([romPath]);

    expect(progress[0]).toEqual({ scanned: 0, total: 1 });
    expect(progress.at(-1)).toEqual({ scanned: 1, total: 1 });
    expect(result.matched.map((match) => match.gameName)).toEqual(['Cartridge (USA)']);
  });
});

describe('walkDir', () => {
  it("skips the downloader's staging dir", async () => {
    const staging = join(dir, '.flemarr-tmp');
    await mkdir(staging);
    await writeFile(join(staging, 'partial.bin.part'), 'partial');
    await writeFile(join(dir, 'game.bin'), 'game');

    const paths: string[] = [];
    for await (const path of walkDir(dir)) paths.push(path);

    expect(paths).toEqual([join(dir, 'game.bin')]);
  });
});
