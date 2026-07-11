import type { DatFile } from '@shared/dat.js';
import type { GameDetails } from '@shared/game-details.js';
import { boxartUrl, probeBoxart } from './libretro.js';
import { getCachedDetails, upsertDetails } from './store.js';
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

  const toProbe = gameIds.filter((id) => !cached.has(id) && byId.has(id));
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
      cached.set(p.gameId, {
        gameId: p.gameId,
        provider: p.provider,
        boxartUrl: p.boxartUrl,
        description: null,
        fetchedAt: Math.floor(Date.now() / 1000),
      });
    }
  }

  return gameIds
    .filter((id) => cached.has(id))
    .map((id) => {
      const row = cached.get(id);
      return {
        gameId: id,
        hasBoxart: row?.boxartUrl != null,
        ...(row?.description != null && { description: row.description }),
      };
    });
}

/** Cached upstream boxart URL, for the image proxy route. */
export function cachedBoxartUrl(datId: string, gameId: string): string | null {
  const cached = getCachedDetails(datId, [gameId]);
  return cached.get(gameId)?.boxartUrl ?? null;
}
