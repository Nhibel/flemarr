import { describe, expect, it } from 'vitest';
import { joinPath, pathBasename } from './folder-paths.js';

describe('pathBasename', () => {
  it('returns the last segment of a POSIX path', () => {
    expect(pathBasename('/roms/snes')).toBe('snes');
  });

  it('ignores trailing separators', () => {
    expect(pathBasename('/roms/snes//')).toBe('snes');
  });

  it('handles Windows separators', () => {
    expect(pathBasename('C:\\roms\\snes')).toBe('snes');
  });
});

describe('joinPath', () => {
  it('joins with a slash on a POSIX base', () => {
    expect(joinPath('/roms/', 'snes')).toBe('/roms/snes');
  });

  it('keeps a backslash on a Windows base', () => {
    expect(joinPath('C:\\roms', 'snes')).toBe('C:\\roms\\snes');
  });
});
