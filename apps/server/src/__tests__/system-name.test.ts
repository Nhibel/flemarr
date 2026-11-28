import { describe, it, expect } from 'vitest';
import {
  normalizeSystemName,
  systemMatchKind,
  zipSystemMatch,
  zipMatchesSystem,
  mentionsSystem,
  isReencodedDump,
  withoutLanguages,
} from '../services/archive-org/system-name.js';

const GB = 'Nintendo - Game Boy';
const GBA = 'Nintendo - Game Boy Advance';
const NES = 'Nintendo - Nintendo Entertainment System';
const SNES = 'Nintendo - Super Nintendo Entertainment System';
const PSX = 'Sony - PlayStation';

describe('systemMatchKind', () => {
  it('matches a system exactly against its own set name', () => {
    expect(systemMatchKind('Nintendo - Game Boy', GB)).toBe('exact');
  });

  it('ignores a trailing date tag', () => {
    expect(systemMatchKind('Nintendo - Game Boy (20240101)', GB)).toBe('exact');
  });

  it('matches a bare system name with no vendor prefix', () => {
    expect(systemMatchKind('Game Boy', GB)).toBe('exact');
  });

  it('matches an alias exactly', () => {
    expect(systemMatchKind('SNES', SNES)).toBe('exact');
  });

  // The whole point: these are the names of *other* systems. They have to be
  // recognised as loose, never exact, or the suggester picks the wrong set.
  it.each([
    ['Nintendo - Game Boy Advance', GB],
    ['Nintendo - Game Boy Color', GB],
    ['Nintendo - Super Nintendo Entertainment System', NES],
    ['Sony - PlayStation 2', PSX],
    ['Sony - PlayStation Portable', PSX],
  ])('rates %s as a loose match for %s, not exact', (text, system) => {
    expect(systemMatchKind(text, system)).toBe('loose');
  });

  it('still matches a descriptive title loosely (needed for discovery)', () => {
    expect(systemMatchKind('No-Intro Game Boy fullset', GB)).toBe('loose');
  });

  it('returns null for an unrelated system', () => {
    expect(systemMatchKind('Sega - Mega Drive - Genesis', GB)).toBeNull();
  });

  it('does not treat a shorter sibling as the longer system', () => {
    expect(systemMatchKind('Nintendo - Game Boy', GBA)).toBeNull();
  });
});

describe('zipSystemMatch', () => {
  it('reads through a path and extension', () => {
    expect(zipSystemMatch('roms/Nintendo - Game Boy.zip', GB)).toBe('exact');
  });

  it('rates a sibling system zip as loose', () => {
    expect(zipSystemMatch('roms/Nintendo - Game Boy Color.zip', GB)).toBe('loose');
  });

  it('keeps zipMatchesSystem true for either kind', () => {
    expect(zipMatchesSystem('Nintendo - Game Boy.zip', GB)).toBe(true);
    expect(zipMatchesSystem('Nintendo - Game Boy Advance.zip', GB)).toBe(true);
    expect(zipMatchesSystem('Sega - Saturn.zip', GB)).toBe(false);
  });
});

describe('existing helpers are unchanged', () => {
  it('normalizeSystemName still strips vendor and tags', () => {
    expect(normalizeSystemName('Nintendo - Game Boy (Retool)')).toBe('Game Boy');
  });

  it('mentionsSystem still keeps single-word aliases token-bound', () => {
    expect(mentionsSystem('Super Nintendo Entertainment System', NES)).toBe(true);
    expect(mentionsSystem('SNES fullset', NES)).toBe(false);
  });
});

describe('isReencodedDump', () => {
  it.each(['Game (USA).chd', 'Game.rvz', 'Game.wbfs', 'dir/Game.CISO', 'Game.pbp'])(
    'rejects %s — a re-encode can never satisfy a DAT CRC',
    (name) => {
      expect(isReencodedDump(name)).toBe(true);
    },
  );

  // Byte-preserving containers stay matchable: per-game-zip collections store
  // "Game.sfc" as "Game.zip", which is why name matching ignores extensions.
  it.each(['Game (USA).zip', 'Game.7z', 'Game.bin', 'Game.cue', 'Game.iso', 'Game.sfc'])(
    'keeps %s',
    (name) => {
      expect(isReencodedDump(name)).toBe(false);
    },
  );

  it('ignores a dot-prefixed name with no extension', () => {
    expect(isReencodedDump('.DS_Store')).toBe(false);
  });
});
describe('withoutLanguages', () => {
  it('drops the language list and nothing else', () => {
    expect(withoutLanguages('1080 Snowboarding (USA) (En,Ja,Fr,De) (LodgeNet)')).toBe(
      '1080 Snowboarding (USA) (LodgeNet)',
    );
  });

  it('drops a single language and a script variant', () => {
    expect(withoutLanguages('Tetris (Japan) (En)')).toBe('Tetris (Japan)');
    expect(withoutLanguages('Game (Taiwan) (Zh-Hant,En)')).toBe('Game (Taiwan)');
  });

  it('keeps regions, revisions and other tags', () => {
    expect(withoutLanguages('Kid Icarus (USA, Europe) (Rev 1)')).toBe(
      'Kid Icarus (USA, Europe) (Rev 1)',
    );
    expect(withoutLanguages('Mega Man (World) (Evercade)')).toBe('Mega Man (World) (Evercade)');
  });
});
