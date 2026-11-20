import { describe, expect, it } from 'vitest';
import type { ArchiveFile } from '@shared/archive.js';
import type { ArchiveItemInfo } from '../services/archive-org/metadata.js';
import { itemIndex, zipRanks } from '../services/archive-org/item-index.js';

const SYSTEM = 'Sony - PlayStation';

function info(files: ArchiveFile[]): ArchiveItemInfo {
  return { files, restricted: true, server: 'ia800000.us.archive.org', dir: '/1/items/x' };
}

function file(name: string, crc32?: string): ArchiveFile {
  return { name, size: 1, crc32 };
}

describe('itemIndex', () => {
  it('keeps the first file of each CRC, whatever its case', () => {
    const first = file('a/Game.bin', 'AABBCCDD');
    const index = itemIndex(info([first, file('b/Game.bin', 'aabbccdd')]));
    expect(index.byCrc.get('aabbccdd')).toBe(first);
  });

  it('indexes raw files by basename, leaving out containers and re-encodes', () => {
    const raw = file('sub/Game (USA).bin');
    const index = itemIndex(
      info([raw, file('Game (USA).zip'), file('Game (USA).chd'), file('Other.bin')]),
    );
    expect(index.rawFilesByBase.get('Game (USA)')).toEqual([raw]);
  });

  it('lists containers in item order, by basename', () => {
    const index = itemIndex(info([file('B.zip'), file('x.bin'), file('A.7z'), file('B.7z')]));
    expect(index.zips.map((zip) => zip.name)).toEqual(['B.zip', 'A.7z', 'B.7z']);
    expect(index.zipPositionsByBase.get('B')).toEqual([0, 2]);
  });

  it('builds the index once per metadata object', () => {
    const item = info([file('A.zip')]);
    expect(itemIndex(item)).toBe(itemIndex(item));
  });
});

describe('zipRanks', () => {
  it('groups containers by how their name matches the system, in item order', () => {
    const index = itemIndex(
      info([
        file('Random Game (USA).zip'),
        file('Sony - PlayStation.zip'),
        file('Other Game (USA).zip'),
      ]),
    );
    const ranks = zipRanks(index, SYSTEM);
    expect(ranks.exact).toEqual([1]);
    expect(ranks.none).toEqual([0, 2]);
  });

  it('computes each system once', () => {
    const index = itemIndex(info([file('A.zip')]));
    expect(zipRanks(index, SYSTEM)).toBe(zipRanks(index, SYSTEM));
  });
});
