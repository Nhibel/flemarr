import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from './use-selection.js';
import type { Game } from '@shared/dat.js';

function makeGame(id: string): Game {
  return {
    id,
    name: id,
    region: [],
    languages: [],
    category: 'Game',
    roms: [{ name: 'r.sfc', size: 1024, crc: 'aabbccdd', status: 'good' }],
  };
}

const GAMES = [makeGame('a'), makeGame('b'), makeGame('c')];

describe('useSelection', () => {
  it('starts with empty selection', () => {
    const { result } = renderHook(() => useSelection(GAMES));
    expect(result.current.selected.size).toBe(0);
  });

  it('toggle adds an unselected game', () => {
    const { result } = renderHook(() => useSelection(GAMES));
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(true);
  });

  it('toggle removes an already-selected game', () => {
    const { result } = renderHook(() => useSelection(GAMES));
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(false);
  });

  it('selectAll selects all filtered games', () => {
    const { result } = renderHook(() => useSelection(GAMES));
    act(() => result.current.selectAll());
    expect(result.current.selected.size).toBe(3);
    expect([...result.current.selected]).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('selectAll is scoped to filtered games (not all games)', () => {
    const filtered = [makeGame('a'), makeGame('b')];
    const { result } = renderHook(() => useSelection(filtered));
    act(() => result.current.selectAll());
    expect(result.current.selected.has('c')).toBe(false);
  });

  it('clearAll empties the selection', () => {
    const { result } = renderHook(() => useSelection(GAMES));
    act(() => result.current.selectAll());
    act(() => result.current.clearAll());
    expect(result.current.selected.size).toBe(0);
  });

  it('isAllSelected is true when all filtered games are selected', () => {
    const { result } = renderHook(() => useSelection(GAMES));
    act(() => result.current.selectAll());
    expect(result.current.isAllSelected).toBe(true);
  });

  it('isAllSelected is false when some filtered games are not selected', () => {
    const { result } = renderHook(() => useSelection(GAMES));
    act(() => result.current.toggle('a'));
    expect(result.current.isAllSelected).toBe(false);
  });

  it('does not persist across separate mounts (fresh per screen)', () => {
    const { result: r1, unmount } = renderHook(() => useSelection(GAMES));
    act(() => r1.current.toggle('a'));
    unmount();
    const { result: r2 } = renderHook(() => useSelection(GAMES));
    expect(r2.current.selected.size).toBe(0);
  });
});
