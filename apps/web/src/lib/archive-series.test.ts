import { describe, it, expect } from 'vitest';
import { seriesBase } from './archive-series.js';

describe('seriesBase', () => {
  it('detects a "_partN" suffix', () => {
    expect(seriesBase('sony_playstation_part1')).toBe('sony_playstation');
  });

  it('detects a "_discN" suffix', () => {
    expect(seriesBase('no-intro_collection_disc2')).toBe('no-intro_collection');
  });

  it('detects a "-cdN" suffix', () => {
    expect(seriesBase('mycollection-cd1')).toBe('mycollection');
  });

  it('detects a "_diskN" suffix', () => {
    expect(seriesBase('mycollection_disk3')).toBe('mycollection');
  });

  it('is case-insensitive', () => {
    expect(seriesBase('Collection_PART3')).toBe('Collection');
  });

  it('returns null when there is no trailing number', () => {
    expect(seriesBase('ps1-games')).toBeNull();
  });

  it('returns null when there is a trailing number but no series keyword', () => {
    expect(seriesBase('random123')).toBeNull();
  });

  it('does not mistake a keyword appearing earlier in the identifier for the suffix', () => {
    // "cd" inside "cdrom" must not be read as the series keyword — the real
    // suffix is "_disc1".
    expect(seriesBase('deluxe_cdrom_disc1')).toBe('deluxe_cdrom');
  });
});
