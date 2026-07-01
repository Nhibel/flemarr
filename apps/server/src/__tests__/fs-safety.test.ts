import { describe, it, expect } from 'vitest';
import { assertWithinRoot, PathTraversalError } from '../lib/fs-safety.js';
import { resolve, join } from 'node:path';

const ROOT = resolve('/roms/snes');

describe('assertWithinRoot', () => {
  it('accepts a path directly inside the root', () => {
    expect(() => assertWithinRoot(join(ROOT, 'game.sfc'), ROOT)).not.toThrow();
  });

  it('accepts a deeply nested path inside the root', () => {
    expect(() => assertWithinRoot(join(ROOT, 'sub', 'dir', 'game.sfc'), ROOT)).not.toThrow();
  });

  it('accepts the root itself', () => {
    expect(() => assertWithinRoot(ROOT, ROOT)).not.toThrow();
  });

  it('rejects a path outside the root', () => {
    expect(() => assertWithinRoot(resolve('/roms/ps1/game.bin'), ROOT)).toThrow(PathTraversalError);
  });

  it('rejects a path that is the root prefix but not inside it', () => {
    // /roms/snes-extra is NOT inside /roms/snes
    expect(() => assertWithinRoot(resolve('/roms/snes-extra/game.sfc'), ROOT)).toThrow(
      PathTraversalError,
    );
  });

  it('rejects a path that escapes via ..', () => {
    expect(() => assertWithinRoot(join(ROOT, '..', 'ps1', 'game.bin'), ROOT)).toThrow(
      PathTraversalError,
    );
  });

  it('rejects an absolute path to /etc/passwd', () => {
    expect(() => assertWithinRoot('/etc/passwd', ROOT)).toThrow(PathTraversalError);
  });
});
