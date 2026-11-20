/**
 * Runs `fn` over `items`, at most `size` at a time, and returns the results
 * in item order. Batches rather than a pool: simpler to read, and the
 * callers here have a handful of items, so a slow one barely holds the next
 * batch back.
 */
export async function mapInBatches<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    const batch = items.slice(start, start + size);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}
