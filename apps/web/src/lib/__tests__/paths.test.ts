import { describe, it, expect } from 'vitest';
import { displayPath, absolutePath } from '../paths.js';

describe('displayPath', () => {
  it('passes through when no root is configured', () => {
    expect(displayPath('/mnt/roms/snes', null)).toBe('/mnt/roms/snes');
  });

  it('shows the root itself as /', () => {
    expect(displayPath('/roms', '/roms')).toBe('/');
    expect(displayPath('/roms/', '/roms')).toBe('/');
  });

  it('strips the root prefix', () => {
    expect(displayPath('/roms/SNES', '/roms')).toBe('/SNES');
    expect(displayPath('/roms/SNES/US', '/roms')).toBe('/SNES/US');
  });

  it('does not treat a sibling with the root as prefix as inside it', () => {
    expect(displayPath('/roms-extra/SNES', '/roms')).toBe('/roms-extra/SNES');
  });

  it('leaves paths outside the root untouched', () => {
    expect(displayPath('/mnt/other', '/roms')).toBe('/mnt/other');
  });

  it('handles a Windows root', () => {
    expect(displayPath('D:\\roms\\SNES', 'D:\\roms')).toBe('/SNES');
    expect(displayPath('D:\\roms', 'D:\\roms')).toBe('/');
  });
});

describe('absolutePath', () => {
  it('passes through when no root is configured', () => {
    expect(absolutePath('/mnt/roms/snes', null)).toBe('/mnt/roms/snes');
  });

  it('maps / and empty input to the root', () => {
    expect(absolutePath('/', '/roms')).toBe('/roms');
    expect(absolutePath('', '/roms')).toBe('/roms');
  });

  it('joins a relative display path onto the root', () => {
    expect(absolutePath('/SNES', '/roms')).toBe('/roms/SNES');
    expect(absolutePath('SNES/US', '/roms')).toBe('/roms/SNES/US');
  });

  it('keeps a trailing separator being typed', () => {
    expect(absolutePath('/SNES/', '/roms')).toBe('/roms/SNES/');
  });

  it('keeps a pasted absolute path already under the root', () => {
    expect(absolutePath('/roms/SNES', '/roms')).toBe('/roms/SNES');
  });

  it('uses the root separator style on Windows', () => {
    expect(absolutePath('/SNES/US', 'D:\\roms')).toBe('D:\\roms\\SNES\\US');
  });

  it('round-trips with displayPath', () => {
    for (const p of ['/roms', '/roms/SNES', '/roms/SNES/US Games']) {
      expect(absolutePath(displayPath(p, '/roms'), '/roms')).toBe(p);
    }
  });
});
