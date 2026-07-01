import { describe, it, expect } from 'vitest';
import { buildCrcIndex, matchFiles } from '../services/scanner/matcher.js';
import type { DatFile } from '@shared/dat.js';

const SNES_DAT: DatFile = {
  source: 'no-intro',
  system: 'SNES',
  games: [
    {
      id: 'mario',
      name: 'Super Mario World (USA)',
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [
        { name: 'Super Mario World (USA).sfc', size: 524288, crc: 'b19ed489', status: 'good' },
      ],
    },
    {
      id: 'zelda',
      name: 'The Legend of Zelda - A Link to the Past (USA)',
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [
        {
          name: 'The Legend of Zelda - A Link to the Past (USA).sfc',
          size: 1048576,
          crc: '777251dc',
          status: 'good',
        },
      ],
    },
  ],
};

const PS1_DAT: DatFile = {
  source: 'redump',
  system: 'Sony - PlayStation',
  games: [
    {
      id: 'ff7',
      name: 'Final Fantasy VII (USA) (Disc 1)',
      region: ['USA'],
      languages: [],
      category: 'Game',
      roms: [
        { name: 'Final Fantasy VII (USA) (Disc 1).cue', size: 87, crc: 'a8b56e6a', status: 'good' },
        {
          name: 'Final Fantasy VII (USA) (Disc 1).bin',
          size: 734003008,
          crc: 'f5a4f2d4',
          status: 'good',
        },
      ],
    },
  ],
};

describe('buildCrcIndex', () => {
  it('indexes every ROM by its CRC', () => {
    const index = buildCrcIndex(SNES_DAT);
    expect(index.has('b19ed489')).toBe(true);
    expect(index.has('777251dc')).toBe(true);
  });

  it('indexes multi-ROM games (disc-based)', () => {
    const index = buildCrcIndex(PS1_DAT);
    expect(index.has('a8b56e6a')).toBe(true);
    expect(index.has('f5a4f2d4')).toBe(true);
  });
});

describe('matchFiles', () => {
  const index = buildCrcIndex(SNES_DAT);

  it('classifies a file with matching CRC and correct name as matched', () => {
    const result = matchFiles(
      [{ filePath: '/roms/Super Mario World (USA).sfc', crc: 'b19ed489' }],
      index,
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.gameName).toBe('Super Mario World (USA)');
    expect(result.wrongName).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });

  it('classifies a file with matching CRC but wrong name as wrongName', () => {
    const result = matchFiles([{ filePath: '/roms/mario.sfc', crc: 'b19ed489' }], index);
    expect(result.wrongName).toHaveLength(0 + 1);
    expect(result.wrongName[0]?.currentName).toBe('mario.sfc');
    expect(result.wrongName[0]?.canonicalName).toBe('Super Mario World (USA).sfc');
    expect(result.matched).toHaveLength(0);
  });

  it('classifies a file with unknown CRC as unmatched', () => {
    const result = matchFiles([{ filePath: '/roms/unknown.sfc', crc: 'deadbeef' }], index);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]).toBe('/roms/unknown.sfc');
  });

  it('handles mixed results across multiple files', () => {
    const result = matchFiles(
      [
        { filePath: '/roms/Super Mario World (USA).sfc', crc: 'b19ed489' },
        { filePath: '/roms/zelda.sfc', crc: '777251dc' },
        { filePath: '/roms/unknown.bin', crc: 'cafebabe' },
      ],
      index,
    );
    expect(result.matched).toHaveLength(1);
    expect(result.wrongName).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
  });

  it('handles multi-ROM disc-based games', () => {
    const ps1Index = buildCrcIndex(PS1_DAT);
    const result = matchFiles(
      [
        { filePath: '/roms/Final Fantasy VII (USA) (Disc 1).cue', crc: 'a8b56e6a' },
        { filePath: '/roms/Final Fantasy VII (USA) (Disc 1).bin', crc: 'f5a4f2d4' },
      ],
      ps1Index,
    );
    expect(result.matched).toHaveLength(2);
    expect(result.wrongName).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });

  it('returns empty arrays for empty input', () => {
    const result = matchFiles([], index);
    expect(result.matched).toHaveLength(0);
    expect(result.wrongName).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });
});
