import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatFile } from '@shared/dat.js';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { scanFiles } from '../services/scanner/scan-files.js';

const ROM = Buffer.from('the prg and chr bytes of a cartridge');
const MAGIC = Buffer.from([0x4e, 0x45, 0x53, 0x1a]);
const HEADERED = Buffer.concat([MAGIC, Buffer.alloc(12), ROM]);
const ROM_NAME = 'Battletoads (USA).nes';

function datExpecting(crc: string): DatFile {
  return {
    source: 'no-intro',
    system: 'Nintendo - Nintendo Entertainment System (Headerless)',
    games: [
      {
        id: 'g1',
        name: 'Battletoads (USA)',
        region: ['USA'],
        languages: [],
        roms: [{ name: ROM_NAME, size: ROM.length, crc, status: 'good' }],
      },
    ],
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'flemarr-ines-scan-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function scanOne(name: string, bytes: Buffer, dat: DatFile) {
  const filePath = join(dir, name);
  await writeFile(filePath, bytes);
  return { filePath, result: await scanFiles([filePath], dat, () => undefined) };
}

describe('scanFiles — iNES header', () => {
  const crc = computeCrc32Buffer(ROM);

  it('finds a headered file in a DAT that lists it without its header', async () => {
    const { filePath, result } = await scanOne(ROM_NAME, HEADERED, datExpecting(crc));
    // The DAT's CRC: ownership is looked up with it.
    expect(result.matched).toEqual([
      { filePath, gameName: 'Battletoads (USA)', romName: ROM_NAME, crc },
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it('offers to rename a misnamed headered file', async () => {
    const { result } = await scanOne('Battletoads.nes', HEADERED, datExpecting(crc));
    expect(result.wrongName).toMatchObject([{ canonicalName: ROM_NAME, crc }]);
  });

  it('still finds a file without a header', async () => {
    const { result } = await scanOne(ROM_NAME, ROM, datExpecting(crc));
    expect(result.matched).toHaveLength(1);
  });

  it('still finds a headered file the DAT lists with its header', async () => {
    const fullCrc = computeCrc32Buffer(HEADERED);
    const { result } = await scanOne(ROM_NAME, HEADERED, datExpecting(fullCrc));
    expect(result.matched).toMatchObject([{ crc: fullCrc }]);
  });

  // Manual links are stored under the CRC of the whole file.
  it('keeps the whole file CRC of a headered file the DAT does not list', async () => {
    const { filePath, result } = await scanOne('hack.nes', HEADERED, datExpecting('deadbeef'));
    expect(result.unmatched).toEqual([{ filePath, crc: computeCrc32Buffer(HEADERED) }]);
  });

  it('does not skip the first bytes of a file that has no header', async () => {
    const padded = Buffer.concat([Buffer.alloc(16), ROM]);
    const { result } = await scanOne(ROM_NAME, padded, datExpecting(crc));
    expect(result.unmatched).toHaveLength(1);
  });

  it('copes with a file shorter than a header', async () => {
    const { result } = await scanOne('tiny.nes', MAGIC, datExpecting(crc));
    expect(result.unmatched).toHaveLength(1);
  });
});
