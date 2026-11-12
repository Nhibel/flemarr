import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { extractContainerEntry } from '../services/downloader/worker.js';

// Real 7z-wasm against real tiny containers, not mocked — this is exactly
// the class of bug (NODEFS mounting, argv building, the non-exiting
// quit/onExit override) that mocking the WASM module would hide. Mirrors
// downloader-worker.test.ts's precedent of using real fflate for the
// existing extractFromZip path.
const require = createRequire(import.meta.url);

interface SevenZipModule {
  FS: {
    mkdir(path: string): void;
    mount(type: unknown, opts: { root: string }, mountpoint: string): void;
    chdir(path: string): void;
  };
  NODEFS: unknown;
  callMain(args: string[]): void;
}
interface SevenZipFactory {
  (opts: Record<string, (...args: unknown[]) => void>): Promise<SevenZipModule>;
}

let dir: string;
const content = Buffer.from('this is the raw rom content, byte for byte');
const expectedCrc = computeCrc32Buffer(content);

async function buildContainer(archiveName: string, innerName: string): Promise<string> {
  await writeFile(join(dir, innerName), content);
  const SevenZip = require('7z-wasm') as SevenZipFactory;
  const sevenZip = await SevenZip({
    quit: () => undefined,
    onExit: () => undefined,
    print: () => undefined,
    printErr: () => undefined,
  });
  sevenZip.FS.mkdir('/nodefs');
  sevenZip.FS.mount(sevenZip.NODEFS, { root: dir }, '/nodefs');
  sevenZip.FS.chdir('/nodefs');
  sevenZip.callMain(['a', archiveName, innerName]);
  return join(dir, archiveName);
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rom-curator-extract-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  dir = await mkdtemp(join(tmpdir(), 'rom-curator-extract-test-'));
});

describe('extractContainerEntry', () => {
  it('extracts a named entry from a .7z container and validates its CRC', async () => {
    const containerPath = await buildContainer('Game (USA).7z', 'Game (USA).bin');
    const outputPath = join(dir, 'out.rom');

    const result = await extractContainerEntry({
      containerPath,
      innerPath: 'Game (USA).bin',
      outputPath,
      expectedCrc,
    });

    expect(result).toBe('done');
    expect(await readFile(outputPath)).toEqual(content);
  });

  it('extracts a named entry from a .zip container', async () => {
    const containerPath = await buildContainer('Game (USA).zip', 'Game (USA).cue');
    const outputPath = join(dir, 'out.rom');

    const result = await extractContainerEntry({
      containerPath,
      innerPath: 'Game (USA).cue',
      outputPath,
      expectedCrc,
    });

    expect(result).toBe('done');
    expect(await readFile(outputPath)).toEqual(content);
  });

  it('deletes only the bad extracted output on CRC mismatch, never the container', async () => {
    const containerPath = await buildContainer('Game (USA).7z', 'Game (USA).bin');
    const outputPath = join(dir, 'out.rom');

    const result = await extractContainerEntry({
      containerPath,
      innerPath: 'Game (USA).bin',
      outputPath,
      expectedCrc: 'ffffffff', // deliberately wrong
    });

    expect(result).toBe('crc-mismatch');
    await expect(readFile(outputPath)).rejects.toThrow(); // never written
    await expect(readFile(containerPath)).resolves.toBeDefined(); // container untouched
  });

  it('throws (soft-fail, so the downloader falls through to its fallback) when the entry is missing', async () => {
    const containerPath = await buildContainer('Game (USA).7z', 'Game (USA).bin');
    const outputPath = join(dir, 'out.rom');

    await expect(
      extractContainerEntry({
        containerPath,
        innerPath: 'Does Not Exist.bin',
        outputPath,
        expectedCrc,
      }),
    ).rejects.toThrow();
  });
});
