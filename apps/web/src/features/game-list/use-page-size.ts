import { useState } from 'react';

/** 'all' is a sentinel, not a number — see resolvePageSize below. */
export type PageSize = 20 | 50 | 100 | 'all';

export const PAGE_SIZES: PageSize[] = [20, 50, 100, 'all'];

const STORAGE_KEY = 'rom-curator.page-size';

function load(): PageSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'all') return 'all';
    const n = Number(raw);
    return n === 20 || n === 50 || n === 100 ? n : 50;
  } catch {
    return 50;
  }
}

/**
 * How many games a page shows. 50 stays the default — it was the only size
 * before this existed, and it is the one that keeps the list scrollable
 * rather than endless.
 *
 * Persistent UI preference, so localStorage rather than server settings
 * (ARCHITECTURE.md).
 */
export function usePageSize(): [PageSize, (s: PageSize) => void] {
  const [size, setSize] = useState<PageSize>(load);

  function update(next: PageSize) {
    setSize(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // storage unavailable — the choice just won't survive a reload
    }
  }

  return [size, update];
}

/**
 * The numeric size usePagination needs.
 *
 * 'all' becomes the item count, floored at 1. Neither Infinity nor 0 can be
 * used here: `start = page * Infinity` is NaN, and a size of 0 divides by
 * zero when computing the page count — an empty list would break both ways,
 * which is exactly the case a "show everything" option hits first.
 */
export function resolvePageSize(size: PageSize, itemCount: number): number {
  if (size !== 'all') return size;
  return Math.max(1, itemCount);
}
