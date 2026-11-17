import { describe, it, expect } from 'vitest';
import {
  iconNameCandidates,
  resolveIcon,
  iconUrl,
  buildIndex,
  pathsToNames,
} from './retroarch-assets.js';

/**
 * A slice of the real pinned tree: every name here was copied from
 * retroarch-assets @ 8c918e2, and each one is the upstream spelling that a
 * rule or an alias in the module under test has to reach.
 */
const SYSTEMATIC = [
  'Nintendo - Super Nintendo Entertainment System',
  'Nintendo - GameCube',
  'Sony - PlayStation',
  'Sega - Mega Drive - Genesis',
  'Sega - Naomi',
  'Sega - Naomi (alt)',
  'Atari - 2600',
  'NEC - PC Engine - TurboGrafx 16',
  'NEC - PC-98',
  'SNK - Neo Geo Pocket Color',
  'The 3DO Company - 3DO',
  'Commodore - Amiga',
  'Nintendo - Super Nintendo Entertainment System-content',
];
const MONOCHROME = [
  'Nintendo - Super Nintendo Entertainment System',
  'IBM - PC and Compatibles',
  'Toshiba - Pasopia',
  'The 3DO Company - 3DO',
];

const index = buildIndex({ systematic: SYSTEMATIC, monochrome: MONOCHROME });

describe('pathsToNames', () => {
  it('keeps only the two styles used, and drops the "add content" tiles', () => {
    const names = pathsToNames([
      'xmb/systematic/png/Sony - PlayStation.png',
      'xmb/systematic/png/Sony - PlayStation-content.png',
      'xmb/monochrome/png/Toshiba - Pasopia.png',
      'xmb/pixel/png/Sony - PlayStation.png',
      'xmb/systematic/png/sub/dir/Thing.png',
      'ozone/png/icons/run.png',
      'README.md',
    ]);
    expect(names).toEqual({
      systematic: ['Sony - PlayStation', 'sub/dir/Thing'],
      monochrome: ['Toshiba - Pasopia'],
    });
  });
});

describe('iconNameCandidates', () => {
  it('strips the tags a DAT header appends', () => {
    expect(iconNameCandidates('Sony - PlayStation (Retool) (PropeR)')[0]).toBe(
      'Sony - PlayStation',
    );
  });

  it('offers the form without the vendor repeated inside the name', () => {
    expect(iconNameCandidates('Atari - Atari 2600')).toContain('Atari - 2600');
  });

  it('offers the first half of a name joining two regional names', () => {
    expect(iconNameCandidates('Sega - Mega CD & Sega CD')).toContain('Sega - Mega CD');
  });

  it('offers the form without a trailing "series"', () => {
    expect(iconNameCandidates('NEC - PC-98 series')).toContain('NEC - PC-98');
  });

  it('offers the first two segments of a three-segment name', () => {
    expect(iconNameCandidates('Sega - SG-1000 - SC-3000')).toContain('Sega - SG-1000');
  });

  it('offers the tail without its leading vendor', () => {
    expect(iconNameCandidates('Arcade - Sega - Naomi')).toContain('Sega - Naomi');
  });

  it('puts the alias first when one exists', () => {
    expect(iconNameCandidates('Panasonic - 3DO Interactive Multiplayer')[0]).toBe(
      'The 3DO Company - 3DO',
    );
  });
});

describe('resolveIcon', () => {
  it('matches a name that differs only in spacing or punctuation', () => {
    // The DAT writes "NeoGeo", the icon file writes "Neo Geo".
    expect(resolveIcon('SNK - NeoGeo Pocket Color', index)).toEqual({
      style: 'systematic',
      name: 'SNK - Neo Geo Pocket Color',
    });
    expect(resolveIcon('NEC - PC Engine - TurboGrafx-16', index)).toEqual({
      style: 'systematic',
      name: 'NEC - PC Engine - TurboGrafx 16',
    });
  });

  it('prefers the colour set when both sets have the system', () => {
    expect(resolveIcon('Nintendo - Super Nintendo Entertainment System', index)?.style).toBe(
      'systematic',
    );
  });

  it('falls back to the silhouette when only it has the system', () => {
    expect(resolveIcon('Toshiba - Pasopia', index)).toEqual({
      style: 'monochrome',
      name: 'Toshiba - Pasopia',
    });
  });

  it('keeps the plain name over a later "(alt)" variant', () => {
    expect(resolveIcon('Arcade - Sega - Naomi', index)?.name).toBe('Sega - Naomi');
  });

  it('follows an alias to another vendor entirely', () => {
    expect(resolveIcon('3DO Interactive Multiplayer', index)?.name).toBe('The 3DO Company - 3DO');
    expect(resolveIcon('Commodore - Amiga CD32', index)?.name).toBe('Commodore - Amiga');
    expect(resolveIcon('IBM - PC compatible', index)?.name).toBe('IBM - PC and Compatibles');
  });

  it('returns null when nothing upstream covers the system', () => {
    expect(resolveIcon('Video CD', index)).toBeNull();
    expect(resolveIcon('Arcade - Konami - System 573', index)).toBeNull();
  });

  it('never matches an "add content" tile', () => {
    const names = index.get('systematic');
    expect([...(names?.values() ?? [])].some((n) => n.endsWith('-content'))).toBe(false);
  });
});

describe('iconUrl', () => {
  it('builds a pinned raw URL with the filename encoded', () => {
    expect(iconUrl({ style: 'systematic', name: 'Sega - Mega Drive - Genesis' })).toBe(
      'https://raw.githubusercontent.com/libretro/retroarch-assets/8c918e2872482139273374ef4cc6c7aff34d7585/xmb/systematic/png/Sega%20-%20Mega%20Drive%20-%20Genesis.png',
    );
  });
});
