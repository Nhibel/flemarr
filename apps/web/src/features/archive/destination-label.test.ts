import { describe, expect, it } from 'vitest';
import { destinationLabel } from './destination-label.js';

describe('destinationLabel', () => {
  it('names the browser for a browser download, whatever the folder', () => {
    expect(destinationLabel('browser', '/roms/snes', '/roms')).toBe('→ Mon navigateur');
  });

  it('shows the server folder relative to the library root', () => {
    expect(destinationLabel('server', '/roms/snes', '/roms')).toBe('→ /snes');
  });

  it('shows the absolute folder without a library root', () => {
    expect(destinationLabel('server', '/data/snes', null)).toBe('→ /data/snes');
  });

  it('shows nothing for a server download without a folder', () => {
    expect(destinationLabel('server', '', '/roms')).toBeNull();
  });
});
