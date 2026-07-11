import { useState } from 'react';

export const PAGE_SIZE = 50;

export interface Pagination<T> {
  /** Items of the current page. */
  pageItems: T[];
  /** Zero-based page index, always clamped to the valid range. */
  page: number;
  pageCount: number;
  /** Index in `items` of the first item of the page (for "x–y of N" display). */
  start: number;
  total: number;
  next: () => void;
  prev: () => void;
}

/**
 * Client-side pagination over an already filtered/sorted array. The page
 * resets to the first one whenever `items` changes identity — upstream
 * (useGameFilters) memoizes the array, so identity changes exactly when the
 * filters, the sort or the DAT change.
 *
 * Contract: `items` must be referentially stable across unrelated re-renders
 * (i.e. memoized by the caller). Passing a freshly-built array on every
 * render would reset the page each time and loop the render.
 */
export function usePagination<T>(items: T[], pageSize: number = PAGE_SIZE): Pagination<T> {
  const [page, setPage] = useState(0);
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    start,
    total: items.length,
    next: () => setPage((p) => Math.min(p + 1, pageCount - 1)),
    prev: () => setPage((p) => Math.max(p - 1, 0)),
  };
}
