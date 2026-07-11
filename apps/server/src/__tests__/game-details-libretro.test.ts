import { describe, it, expect } from 'vitest';
import {
  libretroSystemDir,
  libretroThumbName,
  boxartUrl,
} from '../services/game-details/libretro.js';

describe('libretroSystemDir', () => {
  it('strips the Retool suffix', () => {
    expect(libretroSystemDir('Nintendo - Super Nintendo Entertainment System (Retool)')).toBe(
      'Nintendo - Super Nintendo Entertainment System',
    );
  });

  it('strips stacked trailing tags (dates, Retool)', () => {
    expect(libretroSystemDir('Sony - PlayStation (Retool 2026-07-10) (1G1R)')).toBe(
      'Sony - PlayStation',
    );
  });

  it('keeps names without tags unchanged', () => {
    expect(libretroSystemDir('Sega - Mega Drive - Genesis')).toBe('Sega - Mega Drive - Genesis');
  });

  it('keeps the vendor prefix (unlike the archive.org normalizer)', () => {
    expect(libretroSystemDir('Nintendo - Game Boy Advance (Retool)')).toBe(
      'Nintendo - Game Boy Advance',
    );
  });

  it('maps systems whose libretro directory name diverges from the DAT name', () => {
    expect(libretroSystemDir('Sega - Mega CD & Sega CD (Retool)')).toBe('Sega - Mega-CD - Sega CD');
    expect(libretroSystemDir('NEC - PC Engine CD & TurboGrafx CD')).toBe(
      'NEC - PC Engine CD - TurboGrafx-CD',
    );
  });
});

describe('libretroThumbName', () => {
  it('replaces forbidden characters with underscores', () => {
    expect(libretroThumbName("Legend of Zelda, The: A Link's Awakening")).toBe(
      "Legend of Zelda, The_ A Link's Awakening.png",
    );
    expect(libretroThumbName('Q*bert & Friends')).toBe('Q_bert _ Friends.png');
  });

  it('keeps parentheses and hyphens — they are part of canonical names', () => {
    expect(libretroThumbName('Super Mario World (USA)')).toBe('Super Mario World (USA).png');
  });
});

describe('boxartUrl', () => {
  it('builds the full encoded URL', () => {
    expect(boxartUrl('Nintendo - Game Boy (Retool)', 'Tetris (World) (Rev 1)')).toBe(
      'https://thumbnails.libretro.com/Nintendo%20-%20Game%20Boy/Named_Boxarts/Tetris%20(World)%20(Rev%201).png',
    );
  });
});
