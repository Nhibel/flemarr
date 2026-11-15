import { useEffect, useRef, useState } from 'react';
import { computeRate, pushSample } from './transfer-rate.js';
import type { RateSample } from './transfer-rate.js';
import type { ItemLike } from './game-status.js';

interface Rates {
  /** Whole-job rate, which is what the time-remaining estimate divides by. */
  rate: number | undefined;
  /** Per game, for the "2,1 Mo/s" the comps put on each row. */
  rates: Map<string, number>;
}

/**
 * Turns the running byte counts into rates.
 *
 * Samples are taken on every render where the totals changed, which is
 * every progress event — the stream is the clock, so there is no interval
 * to run and nothing to tear down beyond the samples themselves.
 *
 * The per-game rates do not sum to the job rate, and are not meant to: each
 * is measured over its own window, and games finish at different times.
 * The job rate is measured on the job's own total, so it is the one the
 * estimate uses.
 */
export function useTransferRates(jobId: string, items: ItemLike[]): Rates {
  const jobSamples = useRef<RateSample[]>([]);
  const gameSamples = useRef<Map<string, RateSample[]>>(new Map());
  const lastJobId = useRef(jobId);
  const [, bump] = useState(0);

  // A retry reuses this component for a different job; stale samples from
  // the previous one would produce a wild first rate.
  if (lastJobId.current !== jobId) {
    lastJobId.current = jobId;
    jobSamples.current = [];
    gameSamples.current = new Map();
  }

  const now = Date.now();
  const jobBytes = items.reduce((sum, i) => sum + i.bytesDownloaded, 0);
  const byGame = new Map<string, number>();
  for (const item of items) {
    byGame.set(item.gameId, (byGame.get(item.gameId) ?? 0) + item.bytesDownloaded);
  }

  const lastJob = jobSamples.current[jobSamples.current.length - 1];
  if (lastJob === undefined || lastJob.bytes !== jobBytes) {
    jobSamples.current = pushSample(jobSamples.current, { at: now, bytes: jobBytes });
  }
  for (const [gameId, bytes] of byGame) {
    const samples = gameSamples.current.get(gameId) ?? [];
    const last = samples[samples.length - 1];
    if (last === undefined || last.bytes !== bytes) {
      gameSamples.current.set(gameId, pushSample(samples, { at: now, bytes }));
    }
  }

  // Without this the displayed rate would freeze between progress events —
  // including at the end of a download, where it would be left showing the
  // last speed forever instead of ageing out of the window.
  useEffect(() => {
    const id = setInterval(() => bump((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const rates = new Map<string, number>();
  for (const [gameId, samples] of gameSamples.current) {
    const r = computeRate(samples, now);
    if (r !== undefined) rates.set(gameId, r);
  }

  return { rate: computeRate(jobSamples.current, now), rates };
}
