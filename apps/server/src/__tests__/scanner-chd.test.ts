import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import chdman from 'chdman';
import { computeCrc32Buffer } from '../lib/crc32.js';
import { buildCrcIndex } from '../services/scanner/matcher.js';
import { matchChdFile } from '../services/scanner/chd-match.js';
import type { DatFile } from '@shared/dat.js';

// Real chdman against a real tiny 2-track disc, not mocked — same
// precedent as chd-convert.test.ts and this session's archive-extract.test.ts.
const SECTOR = 2352;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'flemarr-scanner-chd-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function buildTestChd(): Promise<{ dat: DatFile; chdPath: string }> {
  const track1 = Buffer.alloc(SECTOR * 10, 1);
  const track2 = Buffer.alloc(SECTOR * 10, 2);
  const cuePath = join(dir, 'Game (USA).cue');
  await writeFile(join(dir, 'Game (USA) (Track 1).bin'), track1);
  await writeFile(join(dir, 'Game (USA) (Track 2).bin'), track2);
  await writeFile(
    cuePath,
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

  const chdPath = join(dir, 'Game (USA).chd');
  await chdman.createCd({ inputFilename: cuePath, outputFilename: chdPath, force: true });

  const dat: DatFile = {
    source: 'redump',
    system: 'Sony - PlayStation',
    games: [
      {
        id: 'g1',
        name: 'Game (USA)',
        region: ['USA'],
        languages: ['En'],
        roms: [
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
          // The DAT's own expected .cue CRC — never reproducible from a
          // CHD's regenerated cue sheet, which is exactly what this test
          // is here to confirm matchChdFile still accounts for.
          { name: 'Game (USA).cue', size: 86, crc: 'deadbeef', status: 'good' },
        ],
      },
    ],
  };

  return { dat, chdPath };
}

describe('matchChdFile', () => {
  it('matches every data track by CRC and infers the .cue once its siblings are complete', async () => {
    const { dat, chdPath } = await buildTestChd();
    const index = buildCrcIndex(dat);

    const matched = await matchChdFile(chdPath, index);

    const romNames = matched.map((m) => m.romName).sort();
    expect(romNames).toEqual(
      ['Game (USA) (Track 1).bin', 'Game (USA) (Track 2).bin', 'Game (USA).cue'].sort(),
    );
    // Every entry points at the one real .chd file on disk, not a scratch path.
    expect(matched.every((m) => m.filePath === chdPath)).toBe(true);
    // The inferred .cue entry uses the DAT's own expected CRC, not a real hash.
    expect(matched.find((m) => m.romName === 'Game (USA).cue')?.crc).toBe('deadbeef');
  });

  it('does not infer the .cue when a sibling track fails to match', async () => {
    const { dat, chdPath } = await buildTestChd();
    // Track 2 stays a rom of this game (so it's still one of the "other
    // roms" that must match) but is given a CRC that the real extracted
    // track can never produce — simulating a corrupt/wrong CHD for an
    // otherwise-known game, not a single-track disc.
    const partialDat: DatFile = {
      ...dat,
      games: [
        {
          ...dat.games[0]!,
          roms: dat.games[0]!.roms.map((r) =>
            r.name === 'Game (USA) (Track 2).bin' ? { ...r, crc: 'ffffffff' } : r,
          ),
        },
      ],
    };
    const index = buildCrcIndex(partialDat);

    const matched = await matchChdFile(chdPath, index);

    // Track 2 can't match (its real CRC isn't in the index under any
    // rom), so "every other rom" isn't satisfied — the .cue must not be
    // inferred either.
    expect(matched.map((m) => m.romName)).toEqual(['Game (USA) (Track 1).bin']);
  });

  it('returns no matches for a .chd with no corresponding DAT entries', async () => {
    const { chdPath } = await buildTestChd();
    const emptyIndex = buildCrcIndex({ source: 'redump', system: 'x', games: [] });

    const matched = await matchChdFile(chdPath, emptyIndex);

    expect(matched).toEqual([]);
  });
});
