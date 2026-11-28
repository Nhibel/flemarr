import { describe, it, expect } from 'vitest';
import type { ScanResult } from '@shared/scan.js';
import { foundGames, ownedGameNames, scannedFileCount, splitUnmatched } from '../scan-summary.js';

// One disc game converted to a single .chd: the scan reports one match per
// rom of the DAT, all under the same file.
const CHD = '/roms/psx/Bloody Roar (USA).chd';
const ONE_CHD: ScanResult = {
  matched: [
    { filePath: CHD, gameName: 'Bloody Roar (USA)', romName: 'Bloody Roar (USA).cue', crc: '1' },
    { filePath: CHD, gameName: 'Bloody Roar (USA)', romName: 'Track 1.bin', crc: '2' },
    { filePath: CHD, gameName: 'Bloody Roar (USA)', romName: 'Track 2.bin', crc: '3' },
  ],
  wrongName: [],
  unmatched: [],
};

describe('foundGames', () => {
  it('counts a game once however many of its roms matched', () => {
    expect(foundGames(ONE_CHD)).toEqual(['Bloody Roar (USA)']);
  });

  it('sorts the games by name', () => {
    const result: ScanResult = {
      ...ONE_CHD,
      matched: [
        { filePath: '/b.sfc', gameName: 'Zelda', romName: 'b.sfc', crc: '4' },
        { filePath: '/a.sfc', gameName: 'Axelay', romName: 'a.sfc', crc: '5' },
      ],
    };
    expect(foundGames(result)).toEqual(['Axelay', 'Zelda']);
  });
});

describe('scannedFileCount', () => {
  it('counts a file on disk once', () => {
    expect(scannedFileCount(ONE_CHD)).toBe(1);
  });

  it('adds the misnamed and unknown files', () => {
    const result: ScanResult = {
      ...ONE_CHD,
      wrongName: [
        {
          filePath: '/roms/psx/x.bin',
          currentName: 'x.bin',
          canonicalName: 'X.bin',
          crc: '6',
          gameName: 'X',
        },
      ],
      unmatched: [{ filePath: '/roms/psx/junk.txt' }],
    };
    expect(scannedFileCount(result)).toBe(3);
  });
});

describe('splitUnmatched', () => {
  it('separates the attached files from the rest', () => {
    const attached = { filePath: '/a.gbc', crc: '0000000a' };
    const other = { filePath: '/b.gbc', crc: '0000000b' };
    const link = { fileCrc: '0000000a', gameId: 'g1', gameName: 'A (USA)' };
    expect(splitUnmatched([attached, other], [link])).toEqual({
      linked: [{ ...attached, link }],
      unlinked: [other],
    });
  });

  it('leaves a file without a CRC unattached', () => {
    const file = { filePath: '/a.gbc' };
    expect(splitUnmatched([file], [])).toEqual({ linked: [], unlinked: [file] });
  });
});

describe('ownedGameNames', () => {
  it('holds the games found, misnamed or attached', () => {
    const result: ScanResult = {
      ...ONE_CHD,
      wrongName: [
        {
          filePath: '/x.bin',
          currentName: 'x.bin',
          canonicalName: 'X.bin',
          crc: '6',
          gameName: 'X',
        },
      ],
    };
    const link = { fileCrc: '0000000a', gameId: 'g1', gameName: 'A (USA)' };
    const linked = [{ filePath: '/a.gbc', crc: '0000000a', link }];
    expect(ownedGameNames(result, linked)).toEqual(new Set(['Bloody Roar (USA)', 'X', 'A (USA)']));
  });
});
