import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  libretroSystemDir,
  libretroThumbName,
  boxartUrl,
  mirrorOf,
  findBoxart,
  fetchBoxart,
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

const SMW = boxartUrl('Nintendo - Super Nintendo Entertainment System', 'Super Mario World (USA)');
const SMW_MIRROR =
  'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Boxarts/Super%20Mario%20World%20(USA).png';

describe('mirrorOf', () => {
  it('points at the GitHub repository of the system', () => {
    expect(mirrorOf(SMW)).toBe(SMW_MIRROR);
  });

  it('keeps the hyphens of an aliased directory', () => {
    const url = boxartUrl('Sega - Mega CD & Sega CD', 'Sonic CD (USA)');
    expect(mirrorOf(url)).toContain('/libretro-thumbnails/Sega_-_Mega-CD_-_Sega_CD/master/');
  });

  it('has no mirror for another host', () => {
    expect(mirrorOf('https://example.com/a.png')).toBeNull();
  });
});

describe('findBoxart / fetchBoxart', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Each URL answers a status, or fails on the network.
  function stubFetch(answer: (url: string) => number | Error) {
    const fetchMock = vi.fn((url: string) => {
      const outcome = answer(url);
      if (outcome instanceof Error) return Promise.reject(outcome);
      return Promise.resolve(new Response(url, { status: outcome }));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('keeps the provider URL when the provider has it', async () => {
    const fetchMock = stubFetch(() => 200);
    expect(await findBoxart(SMW)).toBe(SMW);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the mirror when the provider misses', async () => {
    stubFetch((url) => (url === SMW ? 404 : 200));
    expect(await findBoxart(SMW)).toBe(SMW_MIRROR);
  });

  it('falls back to the mirror when the provider is unreachable', async () => {
    stubFetch((url) => (url === SMW ? new Error('ECONNRESET') : 200));
    expect(await findBoxart(SMW)).toBe(SMW_MIRROR);
  });

  it('reports a miss only when both answered', async () => {
    stubFetch(() => 404);
    expect(await findBoxart(SMW)).toBeNull();
  });

  // An outage must not be cached as "no boxart".
  it('throws when a probe failed on the network and none found it', async () => {
    stubFetch((url) => (url === SMW ? new Error('ECONNRESET') : 404));
    await expect(findBoxart(SMW)).rejects.toThrow('ECONNRESET');
  });

  it('fetches the bytes from the mirror when the provider fails', async () => {
    stubFetch((url) => (url === SMW ? 404 : 200));
    const response = await fetchBoxart(SMW);
    expect(await response.text()).toBe(SMW_MIRROR);
  });
});
