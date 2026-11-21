import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageSize, resolvePageSize, PAGE_SIZES } from '../use-page-size.js';

const STORAGE_KEY = 'flemarr.page-size';

beforeEach(() => {
  localStorage.clear();
});

describe('usePageSize', () => {
  it('defaults to 50', () => {
    const { result } = renderHook(() => usePageSize());
    expect(result.current[0]).toBe(50);
  });

  it('round-trips every offered size through localStorage', () => {
    for (const size of PAGE_SIZES) {
      const { result } = renderHook(() => usePageSize());
      act(() => result.current[1](size));
      expect(result.current[0]).toBe(size);

      // A fresh mount has to read back what the previous one stored —
      // 'all' goes through String() and must not come back as NaN.
      const { result: reread } = renderHook(() => usePageSize());
      expect(reread.current[0]).toBe(size);
    }
  });

  it('falls back to the default on a stored value that is not offered', () => {
    for (const bad of ['', '37', 'tout', 'Infinity', 'null']) {
      localStorage.setItem(STORAGE_KEY, bad);
      const { result } = renderHook(() => usePageSize());
      expect(result.current[0], `stored ${bad}`).toBe(50);
    }
  });
});

describe('resolvePageSize', () => {
  it('passes a numeric size straight through', () => {
    expect(resolvePageSize(20, 1842)).toBe(20);
    expect(resolvePageSize(100, 5)).toBe(100);
  });

  it('turns "all" into the item count', () => {
    expect(resolvePageSize('all', 1842)).toBe(1842);
  });

  // The case "show everything" hits first, and the one that breaks both
  // obvious implementations: Infinity makes `page * size` NaN, and 0
  // divides by zero computing the page count.
  it('never returns zero for an empty list', () => {
    expect(resolvePageSize('all', 0)).toBe(1);
    expect(Number.isFinite(resolvePageSize('all', 0))).toBe(true);
  });
});
