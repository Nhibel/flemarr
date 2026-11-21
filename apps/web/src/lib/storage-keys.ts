/**
 * Every localStorage key the app writes, in one place so that the rename
 * migration below cannot miss one.
 *
 * index.html reads the theme key too, in an inline script that runs before
 * this module loads; keep it in step with `theme` here.
 */
export const STORAGE_KEYS = {
  theme: 'flemarr-theme',
  fontScale: 'flemarr-font-scale',
  displayMode: 'flemarr.display-mode',
  pageSize: 'flemarr.page-size',
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

/**
 * The keys as they were named before the app was renamed from rom-curator
 * to Flemarr (2026-11-21). Only migrateStorageKeys reads them; drop this
 * table and the migration once every browser in use has opened the app
 * since the rename.
 */
export const LEGACY_STORAGE_KEYS: Record<StorageKeyName, string> = {
  theme: 'rom-curator-theme',
  fontScale: 'rom-curator-font-scale',
  displayMode: 'rom-curator.display-mode',
  pageSize: 'rom-curator.page-size',
};
