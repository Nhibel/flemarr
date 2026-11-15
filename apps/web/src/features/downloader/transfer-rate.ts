/**
 * Transfer rate and time-remaining, computed from successive byte totals.
 *
 * The download stream carries bytes, never a speed or an ETA, so both are
 * derived here rather than added to the protocol — the server has nothing
 * to say about them that the client cannot work out.
 *
 * A sliding window rather than an average since the start: archive.org's
 * throughput swings a lot, and an average over a ten-minute download stops
 * reacting to a stall entirely, which is exactly when the number matters.
 */

export interface RateSample {
  /** Milliseconds, from the same clock throughout (performance.now or Date.now). */
  at: number;
  bytes: number;
}

/** Samples older than this stop counting toward the current rate. */
export const WINDOW_MS = 10_000;

/**
 * Bytes per second over the window, or undefined when there is not enough
 * to say.
 *
 * Undefined, never 0: a rate of zero reads as "stalled", and claiming that
 * from a single sample — which is all a download has in its first second —
 * would be wrong about every download at the moment it starts.
 */
export function computeRate(samples: RateSample[], now: number): number | undefined {
  const recent = samples.filter((s) => now - s.at <= WINDOW_MS);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === undefined || last === undefined || recent.length < 2) return undefined;

  const seconds = (last.at - first.at) / 1000;
  if (seconds <= 0) return undefined;

  // Byte counts only ever grow; a decrease means the job was reset under
  // us, and a negative rate is worse than no rate.
  const delta = last.bytes - first.bytes;
  if (delta < 0) return undefined;
  return delta / seconds;
}

/**
 * Seconds remaining, or undefined when it cannot be known.
 *
 * `remainingBytes` is undefined whenever any unfinished game streams
 * without a Content-Length — see summarizeJob. A zero rate also yields
 * undefined rather than Infinity: a stalled download has no honest
 * estimate, and "∞" is not one.
 */
export function computeEta(
  remainingBytes: number | undefined,
  bytesPerSecond: number | undefined,
): number | undefined {
  if (remainingBytes === undefined || bytesPerSecond === undefined) return undefined;
  if (bytesPerSecond <= 0) return undefined;
  return remainingBytes / bytesPerSecond;
}

/** Appends a sample and drops what has aged out of the window. */
export function pushSample(samples: RateSample[], sample: RateSample): RateSample[] {
  return [...samples, sample].filter((s) => sample.at - s.at <= WINDOW_MS);
}

export function formatRate(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1_048_576) return `${(bytesPerSecond / 1_048_576).toFixed(1)} Mo/s`;
  if (bytesPerSecond >= 1024) return `${Math.round(bytesPerSecond / 1024)} ko/s`;
  return `${Math.round(bytesPerSecond)} o/s`;
}

/**
 * Deliberately vague wording, because the estimate is. "environ 7 minutes"
 * is honest about its precision in a way "7:03" is not, and the comps word
 * it that way too.
 */
export function formatEta(seconds: number): string {
  if (seconds < 45) return 'moins d’une minute';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `environ ${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.round(seconds / 3600);
  return `environ ${hours} heure${hours > 1 ? 's' : ''}`;
}
