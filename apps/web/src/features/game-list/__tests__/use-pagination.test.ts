import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../use-pagination.js';

const items = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('usePagination', () => {
  it('slices the first page and reports counts', () => {
    const data = items(120);
    const { result } = renderHook(() => usePagination(data, 50));
    expect(result.current.pageItems).toHaveLength(50);
    expect(result.current.pageItems[0]).toBe(0);
    expect(result.current.page).toBe(0);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.total).toBe(120);
  });

  it('next/prev move between pages and clamp at both ends', () => {
    const data = items(120);
    const { result } = renderHook(() => usePagination(data, 50));
    act(() => result.current.prev());
    expect(result.current.page).toBe(0);

    act(() => result.current.next());
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems[0]).toBe(50);

    act(() => result.current.next());
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems).toHaveLength(20);

    act(() => result.current.next());
    expect(result.current.page).toBe(2);
  });

  it('resets to page 1 when the input array changes identity', () => {
    let data = items(120);
    const { result, rerender } = renderHook(() => usePagination(data, 50));
    act(() => result.current.next());
    expect(result.current.page).toBe(1);

    data = items(120); // same content, new identity — as filterAndSort produces
    rerender();
    expect(result.current.page).toBe(0);
  });

  it('keeps the page when re-rendered with the same array', () => {
    const data = items(120);
    const { result, rerender } = renderHook(() => usePagination(data, 50));
    act(() => result.current.next());
    rerender();
    expect(result.current.page).toBe(1);
  });

  it('serves a single page when items fit, and an empty page for no items', () => {
    const three = items(3);
    const { result: small } = renderHook(() => usePagination(three, 50));
    expect(small.current.pageCount).toBe(1);
    expect(small.current.pageItems).toHaveLength(3);

    const none = items(0);
    const { result: empty } = renderHook(() => usePagination(none, 50));
    expect(empty.current.pageCount).toBe(1);
    expect(empty.current.pageItems).toHaveLength(0);
  });
});
