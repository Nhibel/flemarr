import type { Game, Rom } from '@shared/dat.js';
import type { GameInfoEntry } from './store.js';
import { logger } from '@/lib/logger.js';

/**
 * ScreenScraper.fr game-info provider — jeuInfos.php lookup by CRC32.
 * Requires a user account (ssid/sspassword) AND an approved developer id
 * (devid/devpassword). Credentials travel as query params: never log the
 * URL of these requests, only game name / status / duration.
 */

const API_BASE = 'https://api.screenscraper.fr/api2/jeuInfos.php';
const SOFTNAME = 'rom-curator';

// Their quotas are per-account and tight (~1-2 req/s): serialize requests
// and space them out. Interval read per call so tests can zero it.
function intervalMs(): number {
  return Number(process.env['SCREENSCRAPER_INTERVAL_MS'] ?? 1100);
}

let nextSlot = 0;
async function acquireSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + intervalMs();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// Once the daily quota is exhausted, stop asking for a while instead of
// burning one failed request per game on every page visit.
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000;
let quotaBlockedUntil = 0;

export function isQuotaBlocked(): boolean {
  return Date.now() < quotaBlockedUntil;
}

/** Test hook: clear throttle and quota state between test cases. */
export function resetScreenScraperState(): void {
  nextSlot = 0;
  quotaBlockedUntil = 0;
}

export interface ScreenScraperCreds {
  ssid: string;
  ssPassword: string;
  devId: string;
  devPassword: string;
}

/**
 * The ROM whose CRC identifies the game on ScreenScraper: the largest one.
 * For disc games that's the .bin (the .cue is a tiny text file ScreenScraper
 * doesn't index); for cartridge games there's only one ROM anyway.
 */
export function pickLookupRom(game: Game): Rom | undefined {
  return [...game.roms].sort((a, b) => b.size - a.size)[0];
}

export function buildJeuInfosUrl(creds: ScreenScraperCreds, rom: Rom): string {
  const params = new URLSearchParams({
    devid: creds.devId,
    devpassword: creds.devPassword,
    softname: SOFTNAME,
    output: 'json',
    ssid: creds.ssid,
    sspassword: creds.ssPassword,
    romtype: 'rom',
    crc: rom.crc,
    romnom: rom.name,
    romtaille: String(rom.size),
  });
  return `${API_BASE}?${params.toString()}`;
}

// The relevant slice of the jeuInfos.php JSON response.
interface JeuInfosResponse {
  response?: {
    jeu?: {
      synopsis?: Array<{ langue?: string; text?: string }>;
      dates?: Array<{ region?: string; text?: string }>;
      genres?: Array<{ noms?: Array<{ langue?: string; text?: string }> }>;
      editeur?: { text?: string };
    };
  };
}

function textForLanguage(
  entries: Array<{ langue?: string; text?: string }> | undefined,
  lang: string,
): string | null {
  return entries?.find((e) => e.langue === lang)?.text ?? null;
}

/** Pure parsing of a jeuInfos response body into a cache entry (sans gameId). */
export function parseJeuInfos(body: unknown): Omit<GameInfoEntry, 'gameId'> | null {
  const jeu = (body as JeuInfosResponse).response?.jeu;
  if (jeu == null) return null;

  // Year: prefer the worldwide date, else the first one that parses.
  const dates = jeu.dates ?? [];
  const dateText =
    dates.find((d) => d.region === 'wor')?.text ?? dates.find((d) => d.text)?.text ?? '';
  const yearMatch = /\d{4}/.exec(dateText);

  // Genre is a single column: prefer the English name (language-neutral
  // enough); the per-language columns are only for the synopses.
  const genreNames = jeu.genres?.[0]?.noms;

  return {
    year: yearMatch ? Number(yearMatch[0]) : null,
    genre: textForLanguage(genreNames, 'en') ?? textForLanguage(genreNames, 'fr'),
    publisher: jeu.editeur?.text ?? null,
    descriptionFr: textForLanguage(jeu.synopsis, 'fr'),
    descriptionEn: textForLanguage(jeu.synopsis, 'en'),
  };
}

export type InfoFetchResult =
  | { status: 'ok'; info: Omit<GameInfoEntry, 'gameId'> }
  | { status: 'miss' } // asked, unknown game → cacheable negative
  | { status: 'skip' }; // quota/auth/network — never cache

function looksLikeQuotaError(status: number, text: string): boolean {
  return status === 429 || status === 430 || /quota/i.test(text);
}

export async function fetchGameInfo(
  creds: ScreenScraperCreds,
  game: Game,
): Promise<InfoFetchResult> {
  if (isQuotaBlocked()) return { status: 'skip' };
  const rom = pickLookupRom(game);
  if (!rom) return { status: 'miss' };

  await acquireSlot();
  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(buildJeuInfosUrl(creds, rom));
  } catch (err) {
    logger.warn({ game: game.name, err: String(err) }, 'screenscraper fetch failed');
    return { status: 'skip' };
  }

  const text = await res.text();
  const ms = Date.now() - start;

  if (!res.ok) {
    if (looksLikeQuotaError(res.status, text)) {
      quotaBlockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
      logger.warn({ status: res.status, ms }, 'screenscraper quota exhausted — pausing');
      return { status: 'skip' };
    }
    // Their "unknown game" answer is a 404 with a French error string.
    if (res.status === 404) {
      logger.info({ game: game.name, ms }, 'screenscraper: game unknown');
      return { status: 'miss' };
    }
    logger.warn({ game: game.name, status: res.status, ms }, 'screenscraper error');
    return { status: 'skip' };
  }

  let parsed: Omit<GameInfoEntry, 'gameId'> | null;
  try {
    parsed = parseJeuInfos(JSON.parse(text));
  } catch {
    logger.warn({ game: game.name, ms }, 'screenscraper: unparseable response');
    return { status: 'skip' };
  }
  logger.info({ game: game.name, found: parsed != null, ms }, 'screenscraper lookup');
  return parsed ? { status: 'ok', info: parsed } : { status: 'miss' };
}
