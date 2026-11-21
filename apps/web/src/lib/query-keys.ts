import type { Fresh1g1rPreset } from '@shared/fresh1g1r.js';

/**
 * Every TanStack Query key in the app, built in one place.
 *
 * A query and the invalidation that refreshes it must use the exact same
 * key; a typo between the two produces a cache that silently never
 * refreshes. Building both from this factory makes that impossible.
 *
 * Keys are hierarchical: `listDirs()` is a prefix of `listDirs(path)`, so
 * invalidating the short form refreshes every listed directory at once.
 */
export const queryKeys = {
  settings: () => ['settings'] as const,
  dats: () => ['dats'] as const,
  games: (datId: string) => ['games', datId] as const,
  lastScan: (datId: string) => ['last-scan', datId] as const,
  runningDownloads: (datId: string) => ['running-downloads', datId] as const,
  downloadHistory: (datId: string) => ['download-history', datId] as const,
  /** Without gameIds: every cached page of the DAT, for an invalidation. */
  gameDetails: (datId: string, gameIds?: string[]) =>
    gameIds === undefined
      ? (['game-details', datId] as const)
      : (['game-details', datId, gameIds] as const),
  datUpdates: () => ['dat-updates'] as const,
  datSources: (preset: Fresh1g1rPreset) => ['dat-sources', preset] as const,
  archiveSources: (system: string) => ['archive-sources', system] as const,
  listDirs: (path?: string) =>
    path === undefined ? (['list-dirs'] as const) : (['list-dirs', path] as const),
  /** `systems` must already be deduplicated and sorted, so equal sets share one entry. */
  systemIcons: (systems: string[]) => ['system-icons', systems.join('\u0000')] as const,
};
