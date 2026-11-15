import { describe, it, expect } from 'vitest';
import {
  computeRate,
  computeEta,
  pushSample,
  formatRate,
  formatEta,
  WINDOW_MS,
} from './transfer-rate.js';

describe('computeRate', () => {
  it('reports bytes per second over the window', () => {
    const rate = computeRate(
      [
        { at: 0, bytes: 0 },
        { at: 2000, bytes: 2_000_000 },
      ],
      2000,
    );
    expect(rate).toBe(1_000_000);
  });

  // A single sample is all a download has in its first second. Reporting 0
  // there would read as "stalled" on every download that just started.
  it('has no answer from fewer than two samples', () => {
    expect(computeRate([], 0)).toBeUndefined();
    expect(computeRate([{ at: 0, bytes: 100 }], 0)).toBeUndefined();
  });

  it('ignores samples older than the window', () => {
    const samples = [
      { at: 0, bytes: 0 },
      { at: WINDOW_MS + 1000, bytes: 1_000_000 },
      { at: WINDOW_MS + 2000, bytes: 1_500_000 },
    ];
    // At that `now`, the first sample has aged out: the rate comes from the
    // last two alone, 500 kB over one second.
    expect(computeRate(samples, WINDOW_MS + 2000)).toBe(500_000);
  });

  it('reports a stall as zero, not as no answer', () => {
    expect(
      computeRate(
        [
          { at: 0, bytes: 1000 },
          { at: 3000, bytes: 1000 },
        ],
        3000,
      ),
    ).toBe(0);
  });

  it('refuses a negative rate when the counter went backwards', () => {
    expect(
      computeRate(
        [
          { at: 0, bytes: 5000 },
          { at: 1000, bytes: 1000 },
        ],
        1000,
      ),
    ).toBeUndefined();
  });
});

describe('computeEta', () => {
  it('divides what is left by the current rate', () => {
    expect(computeEta(10_000_000, 1_000_000)).toBe(10);
  });

  // The case the comps assume away: every restricted re-zipped collection
  // streams without a Content-Length, so there is no remaining-bytes
  // figure at all.
  it('has no answer without a remaining-bytes figure', () => {
    expect(computeEta(undefined, 1_000_000)).toBeUndefined();
  });

  it('has no answer while stalled, rather than reporting infinity', () => {
    expect(computeEta(10_000_000, 0)).toBeUndefined();
    expect(computeEta(10_000_000, undefined)).toBeUndefined();
  });
});

describe('pushSample', () => {
  it('keeps the window and drops what aged out', () => {
    let samples = [{ at: 0, bytes: 0 }];
    samples = pushSample(samples, { at: 5000, bytes: 100 });
    expect(samples).toHaveLength(2);

    samples = pushSample(samples, { at: WINDOW_MS + 1, bytes: 200 });
    expect(samples.map((s) => s.at)).toEqual([5000, WINDOW_MS + 1]);
  });
});

describe('formatting', () => {
  it('scales the rate to a readable unit', () => {
    expect(formatRate(2_202_010)).toBe('2.1 Mo/s');
    expect(formatRate(51_200)).toBe('50 ko/s');
    expect(formatRate(300)).toBe('300 o/s');
  });

  it('words the estimate as vaguely as it deserves', () => {
    expect(formatEta(30)).toBe('moins d’une minute');
    expect(formatEta(420)).toBe('environ 7 minutes');
    expect(formatEta(70)).toBe('environ 1 minute');
    expect(formatEta(7200)).toBe('environ 2 heures');
  });
});
