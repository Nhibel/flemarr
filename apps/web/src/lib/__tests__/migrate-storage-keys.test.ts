import { describe, it, expect, beforeEach } from 'vitest';
import { migrateStorageKeys } from '../migrate-storage-keys.js';

describe('migrateStorageKeys', () => {
  beforeEach(() => localStorage.clear());

  it('moves a preference from its rom-curator key to its Flemarr key', () => {
    localStorage.setItem('rom-curator-theme', 'matrix');
    localStorage.setItem('rom-curator.page-size', '100');

    migrateStorageKeys(localStorage);

    expect(localStorage.getItem('flemarr-theme')).toBe('matrix');
    expect(localStorage.getItem('flemarr.page-size')).toBe('100');
    expect(localStorage.getItem('rom-curator-theme')).toBeNull();
    expect(localStorage.getItem('rom-curator.page-size')).toBeNull();
  });

  it('keeps a value already under the new key and drops the old one', () => {
    localStorage.setItem('rom-curator-font-scale', '16');
    localStorage.setItem('flemarr-font-scale', '20');

    migrateStorageKeys(localStorage);

    expect(localStorage.getItem('flemarr-font-scale')).toBe('20');
    expect(localStorage.getItem('rom-curator-font-scale')).toBeNull();
  });

  it('leaves storage alone when there is nothing to migrate', () => {
    localStorage.setItem('flemarr.display-mode', 'compact');

    migrateStorageKeys(localStorage);

    expect(localStorage.getItem('flemarr.display-mode')).toBe('compact');
    expect(localStorage).toHaveLength(1);
  });
});
