import type { DatFile } from '@shared/dat.js';
import type { GameDetails } from '@shared/game-details.js';
import { boxartUrl, probeBoxart } from './libretro.js';
import { getCachedDetails, upsertDetails, upsertInfo, type GameInfoEntry } from './store.js';
import { fetchGameInfo, isQuotaBlocked, type ScreenScraperCreds } from './screenscraper.js';
import { getSettings } from '@/services/settings/index.js';
import { logger } from '@/lib/logger.js';

const PROVIDER = 'libretro-thumbnails';
// Be polite with the thumbnail server: probe a page with small concurrency.
const PROBE_CONCURRENCY = 4;

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) continue;
      results[i] = await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Details for a page of games: served from the SQLite cache, probing the
 * provider only for games never seen (or whose negative entry expired).
 * Unknown gameIds are silently skipped — the response simply omits them.
 */
export async function getOrFetchDetails(
  datId: string,
  dat: DatFile,
  gameIds: string[],
): Promise<GameDetails[]> {
  const cached = getCachedDetails(datId, gameIds);
  const byId = new Map(dat.games.map((g) => [g.id, g]));

  const toProbe = gameIds.filter((id) => byId.has(id) && cached.get(id)?.boxartKnown !== true);
  if (toProbe.length > 0) {
    const probed = await mapConcurrent(toProbe, PROBE_CONCURRENCY, async (gameId) => {
      const game = byId.get(gameId);
      if (!game) return { gameId, provider: PROVIDER, boxartUrl: null };
      const url = boxartUrl(dat.system, game.name);
      let found = false;
      try {
        found = await probeBoxart(url);
      } catch (err) {
        // Network failure ≠ "no boxart": don't negatively cache it.
        logger.warn({ gameId, url, err: String(err) }, 'boxart probe failed');
        return null;
      }
      return { gameId, provider: PROVIDER, boxartUrl: found ? url : null };
    });

    const fresh = probed.filter((p) => p !== null);
    upsertDetails(datId, fresh);
    logger.info(
      { datId, probed: toProbe.length, found: fresh.filter((p) => p.boxartUrl).length },
      'boxart probes',
    );
    for (const p of fresh) {
      const prev = cached.get(p.gameId);
      cached.set(p.gameId, {
        gameId: p.gameId,
        provider: p.provider,
        boxartUrl: p.boxartUrl,
        boxartKnown: true,
        year: prev?.year ?? null,
        genre: prev?.genre ?? null,
        publisher: prev?.publisher ?? null,
        descriptionFr: prev?.descriptionFr ?? null,
        descriptionEn: prev?.descriptionEn ?? null,
        infoKnown: prev?.infoKnown ?? false,
      });
    }
  }

  // Game info (description/year/genre/publisher) via ScreenScraper — only
  // with a fully configured account, and never while quota-blocked. The
  // provider serializes and throttles internally; a page visit fills what it
  // can and the rest arrives on later visits.
  const settings = getSettings();
  const creds: ScreenScraperCreds = {
    ssid: settings.screenScraperSsid,
    ssPassword: settings.screenScraperSsPassword,
    devId: settings.screenScraperDevId,
    devPassword: settings.screenScraperDevPassword,
  };
  const credsConfigured =
    creds.ssid !== '' && creds.ssPassword !== '' && creds.devId !== '' && creds.devPassword !== '';

  if (credsConfigured && !isQuotaBlocked()) {
    const toFetch = gameIds.filter((id) => byId.has(id) && cached.get(id)?.infoKnown !== true);
    const entries: GameInfoEntry[] = [];
    for (const gameId of toFetch) {
      const game = byId.get(gameId);
      if (!game) continue;
      const result = await fetchGameInfo(creds, game);
      if (result.status === 'skip') {
        if (isQuotaBlocked()) break; // no point trying the rest of the page
        continue;
      }
      const info =
        result.status === 'ok'
          ? result.info
          : { year: null, genre: null, publisher: null, descriptionFr: null, descriptionEn: null };
      entries.push({ gameId, ...info });
    }
    if (entries.length > 0) {
      upsertInfo(datId, entries);
      for (const e of entries) {
        const prev = cached.get(e.gameId);
        cached.set(e.gameId, {
          provider: prev?.provider ?? 'screenscraper',
          boxartUrl: prev?.boxartUrl ?? null,
          boxartKnown: prev?.boxartKnown ?? false,
          ...e,
          infoKnown: true,
        });
      }
    }
  }

  const lang = settings.descriptionLanguage;
  return gameIds
    .filter((id) => cached.has(id))
    .map((id) => {
      const row = cached.get(id);
      const description =
        lang === 'fr'
          ? (row?.descriptionFr ?? row?.descriptionEn)
          : (row?.descriptionEn ?? row?.descriptionFr);
      return {
        gameId: id,
        hasBoxart: row?.boxartUrl != null,
        ...(description != null && { description }),
        ...(row?.year != null && { year: row.year }),
        ...(row?.genre != null && { genre: row.genre }),
        ...(row?.publisher != null && { publisher: row.publisher }),
      };
    });
}

/** Cached upstream boxart URL, for the image proxy route. */
export function cachedBoxartUrl(datId: string, gameId: string): string | null {
  const cached = getCachedDetails(datId, [gameId]);
  return cached.get(gameId)?.boxartUrl ?? null;
}
