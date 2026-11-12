import { describe, it, expect } from 'vitest';
import { detectLayout } from '../services/archive-org/layout.js';
import type { ArchiveFile } from '@shared/archive.js';

function file(name: string, format?: string): ArchiveFile {
  return { name, size: 1024, format };
}

describe('detectLayout', () => {
  it('detects direct layout from individual ROM files', () => {
    const files = [
      file('Super Mario World (USA).sfc'),
      file('F-Zero (USA).sfc'),
      file('Chrono Trigger (USA).sfc'),
      file('collection_meta.xml'),
      file('collection_files.xml'),
    ];
    expect(detectLayout(files)).toBe('direct');
  });

  it('detects zip-collection from a few big ZIPs', () => {
    const files = [
      file('No-Intro SNES 2024-04.zip', 'ZIP'),
      file('No-Intro SNES 2024-04 part2.zip', 'ZIP'),
      file('collection_meta.xml'),
      file('collection_files.xml'),
      file('collection_archive.torrent'),
    ];
    expect(detectLayout(files)).toBe('zip-collection');
  });

  it('detects zip-collection from one-zip-per-game uploads', () => {
    const files = [
      file('Super Mario World (USA).zip'),
      file('F-Zero (USA).zip'),
      file('Chrono Trigger (USA).zip'),
      file('collection_meta.xml'),
    ];
    expect(detectLayout(files)).toBe('zip-collection');
  });

  it('detects zip-collection from one-7z-per-game uploads (Redump rr-sony-* style)', () => {
    // The real bug: a collection like rr-sony-playstation-u stores every
    // game as "Game.7z", never ".zip" — this used to mis-detect as
    // `direct`, which then let findMatch's name fallback treat the
    // compressed .7z as if it were the raw ROM inside it.
    const files = [
      file('Bloody Roar (USA).7z', '7z'),
      file('Bloody Roar II (USA).7z', '7z'),
      file('collection_meta.xml'),
    ];
    expect(detectLayout(files)).toBe('zip-collection');
  });

  it('detects zip-collection from one-rar-per-game uploads', () => {
    const files = [
      file('Bloody Roar (USA).rar', 'rar'),
      file('Bloody Roar II (USA).rar', 'rar'),
      file('collection_meta.xml'),
    ];
    expect(detectLayout(files)).toBe('zip-collection');
  });

  it('detects direct when zips are a minority (e.g. bonus archives)', () => {
    const files = [
      file('Game A.sfc'),
      file('Game B.sfc'),
      file('Game C.sfc'),
      file('extras.zip', 'ZIP'),
    ];
    expect(detectLayout(files)).toBe('direct');
  });

  it('falls back to direct for an empty or metadata-only list', () => {
    expect(detectLayout([])).toBe('direct');
    expect(detectLayout([file('x_meta.xml'), file('x_files.xml')])).toBe('direct');
  });
});
