import { describe, expect, it } from 'vitest';
import { mapInBatches } from '../lib/batches.js';

describe('mapInBatches', () => {
  it('keeps results in item order, whatever finishes first', async () => {
    const delays = [30, 0, 10, 0, 20];
    const results = await mapInBatches(delays, 2, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });
    expect(results).toEqual(delays);
  });

  it('never runs more than the batch size at once', async () => {
    let running = 0;
    let peak = 0;
    await mapInBatches([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
    });
    expect(peak).toBe(3);
  });

  it('returns nothing for no items', async () => {
    expect(await mapInBatches([], 4, async () => 1)).toEqual([]);
  });
});
