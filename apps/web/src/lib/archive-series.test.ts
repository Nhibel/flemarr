import { describe, it, expect, vi } from 'vitest';
import { seriesBase, withSeriesSiblings } from './archive-series.js';

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

describe('withSeriesSiblings', () => {
  it('returns the results untouched when none is part of a series', async () => {
    const search = vi.fn();
    const results = [{ identifier: 'no-intro_snes' }];
    expect(await withSeriesSiblings(results, search)).toBe(results);
    expect(search).not.toHaveBeenCalled();
  });

  it('adds the missing parts of a split collection, once each', async () => {
    const search = vi
      .fn()
      .mockResolvedValue([
        { identifier: 'sony_playstation_part1' },
        { identifier: 'sony_playstation_part2' },
      ]);
    const merged = await withSeriesSiblings([{ identifier: 'sony_playstation_part1' }], search);
    expect(search).toHaveBeenCalledWith('sony_playstation*');
    expect(merged.map((r) => r.identifier)).toEqual([
      'sony_playstation_part1',
      'sony_playstation_part2',
    ]);
  });
});
