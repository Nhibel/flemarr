import { useState, useMemo } from 'react';
import type { Game } from '@shared/dat.js';

export type SortBy = 'name' | 'region' | 'size';
export type SortDir = 'asc' | 'desc';

export interface FilterState {
  search: string;
  regions: string[];
  categories: string[];
  sortBy: SortBy;
  sortDir: SortDir;
}

const REGION_ORDER = ['Europe', 'USA', 'Japan', 'World'];

function regionRank(region: string[]): number {
  const first = region[0];
  if (first === undefined) return REGION_ORDER.length;
  const idx = REGION_ORDER.indexOf(first);
  return idx === -1 ? REGION_ORDER.length : idx;
}

function gameSize(game: Game): number {
  return game.roms.reduce((sum, r) => sum + r.size, 0);
}

export function filterAndSort(games: Game[], state: FilterState): Game[] {
  const search = state.search.toLowerCase();

  let result = games;

  if (search) {
    result = result.filter((g) => g.name.toLowerCase().includes(search));
  }

  if (state.regions.length > 0) {
    result = result.filter((g) => g.region.some((r) => state.regions.includes(r)));
  }

  if (state.categories.length > 0) {
    result = result.filter((g) => state.categories.includes(g.category ?? 'Game'));
  }

  result = [...result].sort((a, b) => {
    let cmp = 0;
    if (state.sortBy === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (state.sortBy === 'region') {
      cmp = regionRank(a.region) - regionRank(b.region);
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
    } else {
      cmp = gameSize(a) - gameSize(b);
    }
    return state.sortDir === 'asc' ? cmp : -cmp;
  });

  return result;
}

const DEFAULT_STATE: FilterState = {
  search: '',
  regions: [],
  categories: [],
  sortBy: 'name',
  sortDir: 'asc',
};

export function useGameFilters(games: Game[]) {
  const [state, setState] = useState<FilterState>(DEFAULT_STATE);

  const filtered = useMemo(() => filterAndSort(games, state), [games, state]);

  function setSearch(search: string) {
    setState((s) => ({ ...s, search }));
  }

  function toggleRegion(region: string) {
    setState((s) => ({
      ...s,
      regions: s.regions.includes(region)
        ? s.regions.filter((r) => r !== region)
        : [...s.regions, region],
    }));
  }

  function toggleCategory(category: string) {
    setState((s) => ({
      ...s,
      categories: s.categories.includes(category)
        ? s.categories.filter((c) => c !== category)
        : [...s.categories, category],
    }));
  }

  function setSortBy(sortBy: SortBy) {
    setState((s) => ({ ...s, sortBy }));
  }

  function toggleSortDir() {
    setState((s) => ({ ...s, sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' }));
  }

  function reset() {
    setState(DEFAULT_STATE);
  }

  return {
    filtered,
    filterState: state,
    setSearch,
    toggleRegion,
    toggleCategory,
    setSortBy,
    toggleSortDir,
    reset,
  };
}
