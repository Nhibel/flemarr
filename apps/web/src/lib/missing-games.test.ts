import { describe, it, expect } from 'vitest';
import { computeMissingGameIds } from './missing-games.js';
import type { Game } from '@shared/dat.js';
import type { ScanResult } from '@shared/scan.js';

function game(id: string, crcs: string[]): Game {
  return {
    id,
    name: id,
    region: ['USA'],
    languages: [],
    category: 'Game',
    roms: crcs.map((crc, i) => ({ name: `${id}-${i}.bin`, size: 1024, crc, status: 'good' })),
  };
}

function scan(matchedCrcs: string[], wrongNameCrcs: string[] = []): ScanResult {
  return {
    matched: matchedCrcs.map((crc) => ({
      filePath: `/roms/${crc}.bin`,
      gameName: 'x',
      romName: 'x.bin',
      crc,
    })),
    wrongName: wrongNameCrcs.map((crc) => ({
      filePath: `/roms/${crc}.bin`,
      currentName: 'bad.bin',
      canonicalName: 'good.bin',
      crc,
      gameName: 'x',
    })),
    unmatched: [],
  };
}

describe('computeMissingGameIds', () => {
  const GAMES = [game('a', ['0000aaaa']), game('b', ['0000bbbb']), game('c', ['0000cccc'])];

  it('returns selected games not present in the scan', () => {
    expect(computeMissingGameIds(['a', 'b', 'c'], GAMES, scan(['0000aaaa']))).toEqual(['b', 'c']);
  });

  it('counts wrongName matches as owned', () => {
    expect(computeMissingGameIds(['a', 'b'], GAMES, scan(['0000aaaa'], ['0000bbbb']))).toEqual([]);
  });

  it('only considers selected games', () => {
    expect(computeMissingGameIds(['a'], GAMES, scan([]))).toEqual(['a']);
  });

  it('treats a multi-disc game as missing when any disc is absent', () => {
    const multi = [game('m', ['00000001', '00000002'])];
    expect(computeMissingGameIds(['m'], multi, scan(['00000001']))).toEqual(['m']);
    expect(computeMissingGameIds(['m'], multi, scan(['00000001', '00000002']))).toEqual([]);
  });

  it('ignores unknown game ids', () => {
    expect(computeMissingGameIds(['zz'], GAMES, scan([]))).toEqual([]);
  });

  it('a nodump ROM (no crc) never counts toward missing', () => {
    const nodumpOnly: Game = {
      id: 'n',
      name: 'n',
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [{ name: 'n-0.bin', size: 1024, status: 'nodump' }],
    };
    expect(computeMissingGameIds(['n'], [nodumpOnly], scan([]))).toEqual([]);
  });

  it('a multi-disc game with one nodump disc is missing only based on the dumped disc', () => {
    const mixed: Game = {
      id: 'mx',
      name: 'mx',
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [
        { name: 'mx-0.bin', size: 1024, crc: '00000001', status: 'good' },
        { name: 'mx-1.bin', size: 1024, status: 'nodump' },
      ],
    };
    expect(computeMissingGameIds(['mx'], [mixed], scan([]))).toEqual(['mx']);
    expect(computeMissingGameIds(['mx'], [mixed], scan(['00000001']))).toEqual([]);
  });
});
