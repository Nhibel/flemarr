import { describe, it, expect } from 'vitest';
import { filterAndSort } from './use-game-filters.js';
import type { Game } from '@shared/dat.js';

function makeGame(overrides: Partial<Game> & Pick<Game, 'name'>): Game {
  return {
    id: overrides.name,
    region: [],
    languages: [],
    category: 'Game',
    roms: [{ name: 'rom.sfc', size: 1024, crc: 'aabbccdd', status: 'good' }],
    ...overrides,
  };
}

const BASE: Game[] = [
  makeGame({ name: 'Zelda (Europe)', region: ['Europe'] }),
  makeGame({
    name: 'Mario (USA)',
    region: ['USA'],
    roms: [{ name: 'r.sfc', size: 2048, crc: '11223344', status: 'good' }],
  }),
  makeGame({ name: 'Castlevania (Japan)', region: ['Japan'] }),
  makeGame({ name: 'Tetris (World)', region: ['World'] }),
  makeGame({ name: 'Demo Game (USA)', region: ['USA'], category: 'Demo' }),
];

const DEFAULT_STATE = {
  search: '',
  regions: [],
  categories: [],
  sortBy: 'name' as const,
  sortDir: 'asc' as const,
};

describe('filterAndSort', () => {
  it('returns all games when no filters are set', () => {
    expect(filterAndSort(BASE, DEFAULT_STATE)).toHaveLength(BASE.length);
  });

  it('filters by search (case-insensitive substring)', () => {
    const result = filterAndSort(BASE, { ...DEFAULT_STATE, search: 'zelda' });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Zelda (Europe)');
  });

  it('returns empty when search matches nothing', () => {
    expect(filterAndSort(BASE, { ...DEFAULT_STATE, search: 'xxxxxxxxxxx' })).toHaveLength(0);
  });

  it('filters by single region', () => {
    const result = filterAndSort(BASE, { ...DEFAULT_STATE, regions: ['USA'] });
    expect(result.every((g) => g.region.includes('USA'))).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters by multiple regions (union)', () => {
    const result = filterAndSort(BASE, { ...DEFAULT_STATE, regions: ['Europe', 'Japan'] });
    expect(result).toHaveLength(2);
  });

  it('filters by category', () => {
    const result = filterAndSort(BASE, { ...DEFAULT_STATE, categories: ['Demo'] });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Demo Game (USA)');
  });

  it('combines search and region filters', () => {
    const result = filterAndSort(BASE, { ...DEFAULT_STATE, search: 'game', regions: ['USA'] });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Demo Game (USA)');
  });

  it('sorts by name ascending (default)', () => {
    const result = filterAndSort(BASE, DEFAULT_STATE);
    const names = result.map((g) => g.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts by name descending', () => {
    const result = filterAndSort(BASE, { ...DEFAULT_STATE, sortDir: 'desc' });
    const names = result.map((g) => g.name);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
  });

  it('sorts by region using Europe > USA > Japan > World order', () => {
    const result = filterAndSort(
      BASE.filter((g) => g.category === 'Game'),
      {
        ...DEFAULT_STATE,
        sortBy: 'region',
      },
    );
    const regions = result.map((g) => g.region[0]);
    expect(regions).toEqual(['Europe', 'USA', 'Japan', 'World']);
  });

  it('sorts by size ascending', () => {
    const result = filterAndSort(
      [
        makeGame({
          name: 'Big (USA)',
          region: ['USA'],
          roms: [{ name: 'r', size: 9999, crc: 'aabbccdd', status: 'good' }],
        }),
        makeGame({
          name: 'Small (USA)',
          region: ['USA'],
          roms: [{ name: 'r', size: 1, crc: '11223344', status: 'good' }],
        }),
      ],
      { ...DEFAULT_STATE, sortBy: 'size' },
    );
    expect(result[0]?.name).toBe('Small (USA)');
    expect(result[1]?.name).toBe('Big (USA)');
  });

  it('does not mutate the input array', () => {
    const copy = [...BASE];
    filterAndSort(BASE, { ...DEFAULT_STATE, sortBy: 'region' });
    expect(BASE).toEqual(copy);
  });
});
