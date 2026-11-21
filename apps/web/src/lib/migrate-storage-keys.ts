import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from './storage-keys.js';
import type { StorageKeyName } from './storage-keys.js';

/**
 * Moves each preference saved under its rom-curator key to its Flemarr key,
 * then deletes the old key. Runs once at startup, before any hook reads
 * its preference, so a renamed key never looks like a reset to the user.
 *
 * A value already under the new key wins: it is the more recent one.
 * Takes the storage as a parameter so tests can hand it a fresh one.
 */
export function migrateStorageKeys(storage: Storage): void {
  for (const name of Object.keys(STORAGE_KEYS) as StorageKeyName[]) {
    const legacyKey = LEGACY_STORAGE_KEYS[name];
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue === null) continue;

    const currentKey = STORAGE_KEYS[name];
    if (storage.getItem(currentKey) === null) storage.setItem(currentKey, legacyValue);
    storage.removeItem(legacyKey);
  }
}
