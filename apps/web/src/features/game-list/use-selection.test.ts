import { describe, it, expect, beforeEach } from 'vitest';
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

beforeEach(() => {
  localStorage.clear();
});

describe('useSelection', () => {
  it('starts with empty selection', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    expect(result.current.selected.size).toBe(0);
  });

  it('toggle adds an unselected game', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(true);
  });

  it('toggle removes an already-selected game', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(false);
  });

  it('selectAll selects all filtered games', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    act(() => result.current.selectAll());
    expect(result.current.selected.size).toBe(3);
    expect([...result.current.selected]).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('selectAll is scoped to filtered games (not all games)', () => {
    const filtered = [makeGame('a'), makeGame('b')];
    const { result } = renderHook(() => useSelection('dat1', filtered));
    act(() => result.current.selectAll());
    expect(result.current.selected.has('c')).toBe(false);
  });

  it('clearAll empties the selection', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    act(() => result.current.selectAll());
    act(() => result.current.clearAll());
    expect(result.current.selected.size).toBe(0);
  });

  it('isAllSelected is true when all filtered games are selected', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    act(() => result.current.selectAll());
    expect(result.current.isAllSelected).toBe(true);
  });

  it('isAllSelected is false when some filtered games are not selected', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    act(() => result.current.toggle('a'));
    expect(result.current.isAllSelected).toBe(false);
  });

  it('persists selection to localStorage', () => {
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    act(() => result.current.toggle('b'));
    const raw = localStorage.getItem('rom-curator.selection.dat1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toContain('b');
  });

  it('restores selection from localStorage on mount', () => {
    localStorage.setItem('rom-curator.selection.dat1', JSON.stringify(['a', 'c']));
    const { result } = renderHook(() => useSelection('dat1', GAMES));
    expect(result.current.selected.has('a')).toBe(true);
    expect(result.current.selected.has('c')).toBe(true);
    expect(result.current.selected.has('b')).toBe(false);
  });

  it('uses separate storage keys for different dat ids', () => {
    const { result: r1 } = renderHook(() => useSelection('dat1', GAMES));
    const { result: r2 } = renderHook(() => useSelection('dat2', GAMES));
    act(() => r1.current.toggle('a'));
    expect(r2.current.selected.has('a')).toBe(false);
  });
});
