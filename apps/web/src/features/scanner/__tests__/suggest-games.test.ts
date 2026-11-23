import { describe, it, expect } from 'vitest';
import type { Game } from '@shared/dat.js';
import { linkableGames, searchGames, suggestGames, titleWords } from '../suggest-games.js';

function game(name: string, romCount = 1): Game {
  const roms = Array.from({ length: romCount }, (_, i) => ({
    name: `${name} ${i}`,
    size: 1,
    status: 'good' as const,
  }));
  return { id: name, name, region: [], languages: [], roms };
}

const GAMES = [
  game('Catwoman (USA)'),
  game('Catz (USA)'),
  game('Barbie - Pet Rescue (USA)'),
  game('Barbie - Ocean Discovery (USA) (GB Compatible)'),
  game('Austin Powers - Welcome to My Underground Lair! (USA)'),
];

const names = (games: Game[]) => games.map((found) => found.name);

describe('titleWords', () => {
  it('drops tags, accents, punctuation and the trailing article', () => {
    expect(titleWords("Aventures de Buzz l'Éclair, Les (France)")).toEqual([
      'aventures',
      'de',
      'buzz',
      'l',
      'eclair',
    ]);
  });
});

describe('suggestGames', () => {
  it('puts the same title first, whatever the region and case', () => {
    expect(names(suggestGames('Catwoman (Europe).gbc', GAMES))).toEqual(['Catwoman (USA)']);
    const file = 'Austin Powers - Welcome to my Underground Lair! (Europe) (En,Fr).gbc';
    expect(names(suggestGames(file, GAMES))[0]).toContain('Underground Lair');
  });

  it('ranks the closest title first', () => {
    expect(names(suggestGames('Barbie - Pet Rescue (Europe).gbc', GAMES))[0]).toBe(
      'Barbie - Pet Rescue (USA)',
    );
  });

  it('suggests nothing for an unrelated title', () => {
    expect(suggestGames("Aventures de Buzz l'Eclair, Les (France).gbc", GAMES)).toEqual([]);
  });
});

describe('searchGames', () => {
  it('wants every word typed', () => {
    expect(names(searchGames('barbie ocean', GAMES))).toEqual([
      'Barbie - Ocean Discovery (USA) (GB Compatible)',
    ]);
  });
});

describe('linkableGames', () => {
  it('leaves out the games of several files', () => {
    expect(linkableGames([game('Disc', 3), game('Cart')]).map((g) => g.name)).toEqual(['Cart']);
  });
});
