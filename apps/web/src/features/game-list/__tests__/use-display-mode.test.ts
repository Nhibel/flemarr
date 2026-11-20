import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDisplayMode } from '../use-display-mode.js';

const KEY = 'rom-curator.display-mode';

beforeEach(() => {
  localStorage.clear();
});

describe('useDisplayMode', () => {
  it('defaults to normal', () => {
    const { result } = renderHook(() => useDisplayMode());
    expect(result.current[0]).toBe('normal');
  });

  it('persists the choice to localStorage', () => {
    const { result } = renderHook(() => useDisplayMode());
    act(() => result.current[1]('compact'));
    expect(result.current[0]).toBe('compact');
    expect(localStorage.getItem(KEY)).toBe('compact');
  });

  it('restores the stored choice on mount', () => {
    localStorage.setItem(KEY, 'compact');
    const { result } = renderHook(() => useDisplayMode());
    expect(result.current[0]).toBe('compact');
  });

  it('falls back to normal for a stale "detailed" value (retired mode)', () => {
    localStorage.setItem(KEY, 'detailed');
    const { result } = renderHook(() => useDisplayMode());
    expect(result.current[0]).toBe('normal');
  });

  it('falls back to normal on a garbage stored value', () => {
    localStorage.setItem(KEY, 'huge');
    const { result } = renderHook(() => useDisplayMode());
    expect(result.current[0]).toBe('normal');
  });
});
