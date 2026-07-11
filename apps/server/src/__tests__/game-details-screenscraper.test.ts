import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pickLookupRom,
  buildJeuInfosUrl,
  parseJeuInfos,
  fetchGameInfo,
  isQuotaBlocked,
  resetScreenScraperState,
} from '../services/game-details/screenscraper.js';
import type { Game } from '@shared/dat.js';

const CREDS = { ssid: 'user', ssPassword: 'up', devId: 'dev', devPassword: 'dp' };

function makeGame(roms: Game['roms']): Game {
  return { id: 'g1', name: 'Some Game (USA)', region: ['USA'], languages: [], roms };
}

const DISC_GAME = makeGame([
  { name: 'Some Game (USA).cue', size: 120, crc: '11111111', status: 'good' },
  { name: 'Some Game (USA) (Track 1).bin', size: 500_000_000, crc: '22222222', status: 'good' },
  { name: 'Some Game (USA) (Track 2).bin', size: 40_000_000, crc: '33333333', status: 'good' },
]);

// The shape jeuInfos.php actually returns (the slice we read).
const FULL_RESPONSE = {
  response: {
    jeu: {
      synopsis: [
        { langue: 'en', text: 'A plumber jumps.' },
        { langue: 'fr', text: 'Un plombier saute.' },
      ],
      dates: [
        { region: 'jp', text: '1994-11-21' },
        { region: 'wor', text: '1995-03-02' },
      ],
      genres: [
        {
          noms: [
            { langue: 'fr', text: 'Plateforme' },
            { langue: 'en', text: 'Platform' },
          ],
        },
      ],
      editeur: { text: 'Nintendo' },
    },
  },
};

describe('pickLookupRom', () => {
  it('picks the largest ROM (the .bin, not the .cue)', () => {
    expect(pickLookupRom(DISC_GAME)?.crc).toBe('22222222');
  });

  it('handles single-rom games and empty rom lists', () => {
    const cart = makeGame([{ name: 'g.sfc', size: 1024, crc: 'aabbccdd', status: 'good' }]);
    expect(pickLookupRom(cart)?.crc).toBe('aabbccdd');
    expect(pickLookupRom(makeGame([]))).toBeUndefined();
  });
});

describe('buildJeuInfosUrl', () => {
  it('carries credentials, crc, name and size', () => {
    const url = new URL(buildJeuInfosUrl(CREDS, DISC_GAME.roms[1]!));
    expect(url.hostname).toBe('api.screenscraper.fr');
    expect(url.searchParams.get('crc')).toBe('22222222');
    expect(url.searchParams.get('romnom')).toBe('Some Game (USA) (Track 1).bin');
    expect(url.searchParams.get('romtaille')).toBe('500000000');
    expect(url.searchParams.get('devid')).toBe('dev');
    expect(url.searchParams.get('ssid')).toBe('user');
    expect(url.searchParams.get('output')).toBe('json');
  });
});

describe('parseJeuInfos', () => {
  it('extracts both synopses, the worldwide year, genre and publisher', () => {
    expect(parseJeuInfos(FULL_RESPONSE)).toEqual({
      year: 1995,
      genre: 'Platform',
      publisher: 'Nintendo',
      descriptionFr: 'Un plombier saute.',
      descriptionEn: 'A plumber jumps.',
    });
  });

  it('tolerates a minimal jeu with everything missing', () => {
    expect(parseJeuInfos({ response: { jeu: {} } })).toEqual({
      year: null,
      genre: null,
      publisher: null,
      descriptionFr: null,
      descriptionEn: null,
    });
  });

  it('falls back to the first dated region and the fr genre name', () => {
    const body = {
      response: {
        jeu: {
          dates: [{ region: 'jp', text: '1994-11-21' }],
          genres: [{ noms: [{ langue: 'fr', text: 'Plateforme' }] }],
        },
      },
    };
    const parsed = parseJeuInfos(body);
    expect(parsed?.year).toBe(1994);
    expect(parsed?.genre).toBe('Plateforme');
  });

  it('returns null when the response has no jeu', () => {
    expect(parseJeuInfos({ response: {} })).toBeNull();
    expect(parseJeuInfos({})).toBeNull();
  });
});

describe('fetchGameInfo', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env['SCREENSCRAPER_INTERVAL_MS'] = '0';
    resetScreenScraperState();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['SCREENSCRAPER_INTERVAL_MS'];
  });

  it('returns ok with parsed info on a full response', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(FULL_RESPONSE), { status: 200 }));
    const result = await fetchGameInfo(CREDS, DISC_GAME);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.info.year).toBe(1995);
  });

  it('returns miss on a 404 (unknown game — cacheable)', async () => {
    fetchMock.mockResolvedValue(new Response('Erreur : Rom non trouvée', { status: 404 }));
    expect((await fetchGameInfo(CREDS, DISC_GAME)).status).toBe('miss');
  });

  it('returns skip and blocks further calls on a quota error', async () => {
    fetchMock.mockResolvedValue(new Response('Votre quota de scrape est dépassé', { status: 430 }));
    expect((await fetchGameInfo(CREDS, DISC_GAME)).status).toBe('skip');
    expect(isQuotaBlocked()).toBe(true);
    // subsequent calls short-circuit without touching the network
    fetchMock.mockClear();
    expect((await fetchGameInfo(CREDS, DISC_GAME)).status).toBe('skip');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns skip on a network failure (never cached as a miss)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    expect((await fetchGameInfo(CREDS, DISC_GAME)).status).toBe('skip');
    expect(isQuotaBlocked()).toBe(false);
  });

  it('returns skip on a 401 (bad credentials, not a game miss)', async () => {
    fetchMock.mockResolvedValue(new Response('Erreur de login', { status: 401 }));
    expect((await fetchGameInfo(CREDS, DISC_GAME)).status).toBe('skip');
  });
});
