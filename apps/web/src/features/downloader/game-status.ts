/**
 * Folds a job's per-file state into one line per game.
 *
 * The event stream is per ROM — a three-disc game downloads three items
 * under one gameId — but a download is something the user asked for per
 * game, and that is what the design comps show: one row, one state, one
 * progress figure. This is where that collapse happens, as a pure function,
 * so the rules are testable without an EventSource.
 */

export type ItemStatus = 'queued' | 'downloading' | 'extracting' | 'done' | 'failed';

export interface ItemLike {
  gameId: string;
  romName: string;
  status: ItemStatus;
  /** 0-100, or -1 when the source reports no Content-Length. */
  progress: number;
  bytesDownloaded: number;
  /** -1 when unknown, 0 before the first progress event. */
  totalBytes: number;
  failReason?: string;
}

export interface ConversionLike {
  status: 'converting' | 'converted' | 'failed';
  reason?: string;
}

export type GameStatusKind =
  'queued' | 'downloading' | 'extracting' | 'converting' | 'done' | 'failed';

export interface GameStatus {
  gameId: string;
  /** The .cue's basename for a disc game, else the first rom's name. */
  label: string;
  kind: GameStatusKind;
  /** 0-100 across the game's files, or -1 if any in-flight file has no total. */
  progress: number;
  bytesDownloaded: number;
  /** -1 when any file's total is unknown, so no remaining-bytes figure exists. */
  totalBytes: number;
  fileCount: number;
  /** The rom names behind this row — cancelling a game cancels each one. */
  files: string[];
  /** Set on `failed`: why, in the words the server gave. */
  reason?: string;
  /** True when the failure was the CHD conversion, not the download. */
  convertFailed?: boolean;
}

/**
 * There is no game display name anywhere in the download stream. For a disc
 * game the .cue's basename is the game's name, and a disc game is the only
 * kind CHD conversion applies to; for anything else the single rom's name
 * is the best available label.
 */
export function gameLabel(items: ItemLike[]): string {
  const cue = items.find((i) => i.romName.toLowerCase().endsWith('.cue'));
  if (cue) return cue.romName.replace(/\.cue$/i, '');
  return items[0]?.romName ?? '';
}

/**
 * Precedence, in order:
 *
 *  1. A failed download wins over everything. One missing disc makes the
 *     game unusable, so a three-disc game with one failure is failed, not
 *     "two thirds done".
 *  2. A failed conversion is also a failure, but a different one — the
 *     bytes are on disk and only the .chd step broke, so the caller can
 *     word it differently via `convertFailed`.
 *  3. Conversion in progress wins over "done": every file has landed, but
 *     the game is not finished until the .chd is verified.
 *  4. Otherwise the least-advanced file decides, so a game reads as
 *     "downloading" until its last disc is in.
 */
export function deriveGameStatus(
  gameId: string,
  items: ItemLike[],
  conversion?: ConversionLike,
): GameStatus {
  const label = gameLabel(items);
  const bytesDownloaded = items.reduce((sum, i) => sum + i.bytesDownloaded, 0);
  // -1 propagates: one unknown total makes the whole game's total unknown,
  // because a partial sum would understate it and produce a percentage that
  // only ever climbs toward a wrong number.
  const totalBytes = items.some((i) => i.totalBytes < 0)
    ? -1
    : items.reduce((sum, i) => sum + i.totalBytes, 0);
  const base = {
    gameId,
    label,
    bytesDownloaded,
    totalBytes,
    fileCount: items.length,
    files: items.map((i) => i.romName),
  };

  const failed = items.find((i) => i.status === 'failed');
  if (failed) {
    return { ...base, kind: 'failed', progress: -1, reason: failed.failReason };
  }
  if (conversion?.status === 'failed') {
    return {
      ...base,
      kind: 'failed',
      progress: 100,
      reason: conversion.reason,
      convertFailed: true,
    };
  }
  if (conversion?.status === 'converting') {
    return { ...base, kind: 'converting', progress: 100 };
  }

  const allDone = items.every((i) => i.status === 'done');
  if (allDone) return { ...base, kind: 'done', progress: 100 };

  // -1 when no total is known yet: rendered as an indeterminate bar.
  const progress =
    totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : -1;

  if (items.some((i) => i.status === 'extracting'))
    return { ...base, kind: 'extracting', progress };
  if (items.some((i) => i.status === 'downloading')) {
    return { ...base, kind: 'downloading', progress };
  }
  return { ...base, kind: 'queued', progress };
}

/** One entry per gameId, in the order the files were queued. */
export function groupByGame(
  items: ItemLike[],
  conversions: Map<string, ConversionLike>,
): GameStatus[] {
  const order: string[] = [];
  const byGame = new Map<string, ItemLike[]>();
  for (const item of items) {
    const existing = byGame.get(item.gameId);
    if (existing) existing.push(item);
    else {
      byGame.set(item.gameId, [item]);
      order.push(item.gameId);
    }
  }
  return order.map((gameId) =>
    deriveGameStatus(gameId, byGame.get(gameId) ?? [], conversions.get(gameId)),
  );
}

export interface JobSummary {
  total: number;
  done: number;
  running: number;
  queued: number;
  failed: number;
  /**
   * Bytes still to transfer, or undefined when any unfinished game has an
   * unknown total — which is every restricted re-zipped collection, not an
   * occasional case. Undefined has to mean "no estimate", never zero: zero
   * would render as "0 seconds left" on a download that has barely started.
   */
  remainingBytes?: number;
}

export function summarizeJob(games: GameStatus[]): JobSummary {
  let done = 0;
  let running = 0;
  let queued = 0;
  let failed = 0;
  let remaining = 0;
  let remainingKnown = true;

  for (const game of games) {
    switch (game.kind) {
      case 'done':
        done += 1;
        continue;
      case 'failed':
        failed += 1;
        continue;
      case 'queued':
        queued += 1;
        break;
      case 'downloading':
      case 'extracting':
      case 'converting':
        running += 1;
        break;
    }

    // Only games still in flight have bytes left to fetch.
    if (game.totalBytes < 0) remainingKnown = false;
    else remaining += Math.max(0, game.totalBytes - game.bytesDownloaded);
  }

  return {
    total: games.length,
    done,
    running,
    queued,
    failed,
    ...(remainingKnown ? { remainingBytes: remaining } : {}),
  };
}
