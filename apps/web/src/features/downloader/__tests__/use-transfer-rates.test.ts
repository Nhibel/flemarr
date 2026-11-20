import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTransferRates } from '../use-transfer-rates.js';
import type { ItemLike } from '../game-status.js';

function item(gameId: string, bytesDownloaded: number): ItemLike {
  return {
    gameId,
    romName: `${gameId}.bin`,
    status: 'downloading',
    progress: -1,
    bytesDownloaded,
    totalBytes: -1,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTransferRates', () => {
  it('has no rate from a single sample', () => {
    const { result } = renderHook(() => useTransferRates('job-1', [item('g1', 0)]));
    expect(result.current.rate).toBeUndefined();
  });

  it('measures the job rate and each game rate from successive progress', () => {
    let items = [item('g1', 0), item('g2', 0)];
    const { result, rerender } = renderHook(() => useTransferRates('job-1', items));

    vi.setSystemTime(2000);
    items = [item('g1', 2000), item('g2', 4000)];
    rerender();

    expect(result.current.rate).toBe(3000);
    expect(result.current.rates.get('g1')).toBe(1000);
    expect(result.current.rates.get('g2')).toBe(2000);
  });

  it('forgets the previous job when reused for another one', () => {
    let jobId = 'job-1';
    let items = [item('g1', 0)];
    const { result, rerender } = renderHook(() => useTransferRates(jobId, items));
    vi.setSystemTime(1000);
    items = [item('g1', 1000)];
    rerender();
    expect(result.current.rate).toBe(1000);

    // A retry reuses the card for a new job whose bytes restart from zero.
    jobId = 'job-2';
    vi.setSystemTime(2000);
    items = [item('g1', 0)];
    rerender();

    expect(result.current.rate).toBeUndefined();
  });
});
