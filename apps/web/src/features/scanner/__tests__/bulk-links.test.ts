import { describe, it, expect } from 'vitest';
import type { Game } from '@shared/dat.js';
import { proposeLinks } from '../bulk-links.js';

function game(name: string, romCount = 1): Game {
  const roms = Array.from({ length: romCount }, (_, i) => ({
    name: `${name} ${i}.nes`,
    size: 1,
    status: 'good' as const,
  }));
  return { id: name, name, region: [], languages: [], roms };
}

const GAMES = [
  game('Metroid (USA)'),
  game('Tetris (USA)'),
  game('Tetris (Japan) (En) (Rev 2) (Bullet-Proof)'),
  game('Super Mario Bros. 2 (USA) (Rev 1)'),
  game('Castlevania (USA) (Rev 1)'),
  game('Castlevania (World) (40th Anniversary)'),
  game('Legend of Zelda, The (USA) (Rev 1)'),
  game('Final Fantasy VII (USA)', 3),
];

function file(name: string, crc = name.length.toString(16).padStart(8, '0')) {
  return { filePath: `/roms/nes/${name}`, crc };
}

function proposal(name: string, games = GAMES, owned: ReadonlySet<string> = new Set()) {
  return proposeLinks([file(name)], games, owned)[0];
}

describe('proposeLinks', () => {
  it('ticks a file whose title is a single game of the DAT', () => {
    expect(proposal('Metroid.nes')).toMatchObject({
      fileName: 'Metroid.nes',
      gameId: 'Metroid (USA)',
      checked: true,
    });
  });

  it('ticks a title whose article No-Intro moved to the end', () => {
    expect(proposal('The Legend of Zelda.nes')).toMatchObject({
      gameId: 'Legend of Zelda, The (USA) (Rev 1)',
      checked: true,
    });
  });

  it('proposes without ticking when two games carry the same title', () => {
    const tetris = proposal('Tetris.nes');
    expect(tetris?.checked).toBe(false);
    expect(tetris?.candidates.map((g) => g.name)).toContain('Tetris (USA)');
  });

  it('proposes without ticking a title that only resembles', () => {
    expect(proposal('Castlevania I.nes')).toMatchObject({ checked: false });
    expect(proposal('Castlevania I.nes')?.gameId).not.toBeNull();
  });

  it('does not tick a game already owned', () => {
    const owned = new Set(['Metroid (USA)']);
    expect(proposal('Metroid.nes', GAMES, owned)?.checked).toBe(false);
  });

  it('ticks neither of two files that point at the same game', () => {
    const files = [
      file('Super Mario Bros. 2.nes'),
      file('Super Mario Bros. 2 (The Lost Levels).nes'),
    ];
    const proposals = proposeLinks(files, GAMES, new Set());
    expect(proposals.map((p) => p.checked)).toEqual([false, false]);
    expect(proposals.map((p) => p.gameId)).toEqual([
      'Super Mario Bros. 2 (USA) (Rev 1)',
      'Super Mario Bros. 2 (USA) (Rev 1)',
    ]);
  });

  it('proposes nothing for an unrelated title, nor a multi-file game', () => {
    expect(proposal('Donkey Kong Classics.nes')).toMatchObject({
      candidates: [],
      gameId: null,
      checked: false,
    });
    expect(proposal('Final Fantasy VII.bin')?.candidates).toEqual([]);
  });

  it('leaves out a file without a CRC', () => {
    expect(proposeLinks([{ filePath: '/roms/x.chd' }], GAMES, new Set())).toEqual([]);
  });
});
