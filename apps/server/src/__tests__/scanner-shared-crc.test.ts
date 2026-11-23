import { describe, it, expect } from 'vitest';
import type { DatFile, Game } from '@shared/dat.js';
import { buildCrcIndex, matchFiles } from '../services/scanner/matcher.js';
import { matchTracks } from '../services/scanner/chd-match.js';

// Redump discs share identical tracks: silence, warning messages, padding.
const SHARED = 'aaaaaaaa';

function game(name: string, roms: [romName: string, crc: string][]): Game {
  return {
    id: name,
    name,
    region: [],
    languages: [],
    roms: roms.map(([romName, crc]) => ({ name: romName, size: 1, crc, status: 'good' as const })),
  };
}

function datOf(...games: Game[]): DatFile {
  return { source: 'redump', system: 'Sony - PlayStation', games };
}

const INDEX = buildCrcIndex(
  datOf(
    game('Alpha', [
      ['Alpha (Track 1).bin', '00000001'],
      ['Alpha (Track 2).bin', SHARED],
    ]),
    game('Beta', [
      ['Beta (Track 1).bin', '00000002'],
      ['Beta (Track 2).bin', SHARED],
    ]),
  ),
);

describe('matchFiles — a CRC shared by several ROMs', () => {
  it('accepts a file that carries any of the names', () => {
    const result = matchFiles(
      [
        { filePath: '/psx/Alpha (Track 2).bin', crc: SHARED },
        { filePath: '/psx/Beta (Track 2).bin', crc: SHARED },
      ],
      INDEX,
    );
    expect(result.wrongName).toEqual([]);
    expect(result.matched.map((match) => match.gameName)).toEqual(['Alpha', 'Beta']);
  });

  it('names a misnamed track after the game its folder holds', () => {
    const result = matchFiles(
      [
        { filePath: '/psx/a/Alpha (Track 1).bin', crc: '00000001' },
        { filePath: '/psx/a/track2.bin', crc: SHARED },
        { filePath: '/psx/b/Beta (Track 1).bin', crc: '00000002' },
      ],
      INDEX,
    );
    expect(result.wrongName).toHaveLength(1);
    expect(result.wrongName[0]).toMatchObject({
      canonicalName: 'Alpha (Track 2).bin',
      gameName: 'Alpha',
    });
    expect(result.wrongName[0]?.alternatives).toBeUndefined();
  });

  it('does not propose a name another file of the folder already carries', () => {
    const result = matchFiles(
      [
        { filePath: '/psx/Alpha (Track 2).bin', crc: SHARED },
        { filePath: '/psx/other.bin', crc: SHARED },
      ],
      INDEX,
    );
    expect(result.wrongName[0]?.canonicalName).toBe('Beta (Track 2).bin');
  });

  it('leaves the choice open when nothing tells the games apart', () => {
    const result = matchFiles([{ filePath: '/psx/x.bin', crc: SHARED }], INDEX);
    expect(result.wrongName[0]?.alternatives).toEqual([
      'Alpha (Track 2).bin',
      'Beta (Track 2).bin',
    ]);
  });

  it('gives identical tracks of one game a name each', () => {
    const index = buildCrcIndex(
      datOf(
        game('Gamma', [
          ['Gamma (Track 2).bin', SHARED],
          ['Gamma (Track 3).bin', SHARED],
        ]),
      ),
    );
    const result = matchFiles(
      [
        { filePath: '/psx/x.bin', crc: SHARED },
        { filePath: '/psx/y.bin', crc: SHARED },
      ],
      index,
    );
    expect(result.wrongName.map((entry) => entry.canonicalName)).toEqual([
      'Gamma (Track 2).bin',
      'Gamma (Track 3).bin',
    ]);
  });
});

describe('matchTracks', () => {
  it('attributes a shared track to the game that explains the most tracks', () => {
    const matches = matchTracks('/psx/x.chd', [SHARED, '00000002'], INDEX);
    expect(matches.map((match) => match.romName)).toEqual([
      'Beta (Track 2).bin',
      'Beta (Track 1).bin',
    ]);
  });

  it('infers the .cue of a game with two identical tracks', () => {
    const index = buildCrcIndex(
      datOf(
        game('Gamma', [
          ['Gamma (Track 1).bin', SHARED],
          ['Gamma (Track 2).bin', SHARED],
          ['Gamma.cue', '00000009'],
        ]),
      ),
    );
    const matches = matchTracks('/psx/x.chd', [SHARED, SHARED], index);
    expect(matches.map((match) => match.romName)).toContain('Gamma.cue');
  });
});
