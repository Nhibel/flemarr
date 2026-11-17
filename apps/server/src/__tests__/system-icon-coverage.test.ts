import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildIndex,
  resolveIcon,
  iconMatchKey,
  STYLES,
  NAME_ALIASES,
} from '../services/system-icon/retroarch-assets.js';

/**
 * Two fixtures, both snapshots of real data:
 *
 *   retroarch-assets-names.json  every icon filename in the two styles used,
 *                                from the pinned commit 8c918e2.
 *   fresh1g1r-proper-systems.json  every system name in the Fresh1G1R PropeR
 *                                  preset, the catalogue the app loads from.
 *
 * Together they measure what the matching rules actually buy, so bumping the
 * pinned commit or editing a rule shows up as a number instead of a silent
 * drop of icons.
 */
function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as T;
}

const names = fixture<Record<string, string[]>>('retroarch-assets-names.json');
const systems = fixture<string[]>('fresh1g1r-proper-systems.json');
const index = buildIndex(names);

describe('system icon coverage', () => {
  // Looked up in the index directly, not through resolveIcon: an alias is
  // an exact upstream filename and must be matched as written. Passing it
  // back through resolveIcon would strip a trailing "(Cartridges)" as if it
  // were a DAT tag and miss a name that does exist.
  it('every alias points at a name that exists upstream', () => {
    const dangling = Object.entries(NAME_ALIASES)
      .filter(([, target]) => !STYLES.some((s) => index.get(s)?.has(iconMatchKey(target))))
      .map(([from, target]) => `${from} -> ${target}`);
    expect(dangling).toEqual([]);
  });

  it('covers the systems the catalogue actually offers', () => {
    const resolved = systems.map((system) => resolveIcon(system, index));
    const colour = resolved.filter((r) => r?.style === 'systematic').length;
    const silhouette = resolved.filter((r) => r?.style === 'monochrome').length;

    // Measured at the pinned commit. Raise these if a rule improves things;
    // a drop means a rule or an alias stopped working.
    expect(colour).toBeGreaterThanOrEqual(265);
    expect(silhouette).toBeGreaterThanOrEqual(29);
    expect(colour + silhouette).toBeGreaterThanOrEqual(294);
  });

  it('covers every mainstream console by name', () => {
    const mainstream = [
      'Nintendo - Nintendo Entertainment System',
      'Nintendo - Super Nintendo Entertainment System',
      'Nintendo - Nintendo 64',
      'Nintendo - GameCube',
      'Nintendo - Game Boy',
      'Nintendo - Game Boy Advance',
      'Nintendo - Wii',
      'Sony - PlayStation',
      'Sony - PlayStation 2',
      'Sony - PlayStation Portable',
      'Sega - Mega Drive - Genesis',
      'Sega - Master System - Mark III',
      'Sega - Saturn',
      'Sega - Dreamcast',
      'NEC - PC Engine - TurboGrafx-16',
      'SNK - NeoGeo Pocket Color',
      'Atari - Atari 2600',
      'Panasonic - 3DO Interactive Multiplayer',
    ];
    const missing = mainstream.filter((s) => resolveIcon(s, index)?.style !== 'systematic');
    expect(missing).toEqual([]);
  });
});
