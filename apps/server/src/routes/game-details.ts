import { Hono } from 'hono';
import { gameDetailsRequestSchema } from '@shared/game-details.js';
import { getDat } from '@/services/dat/index.js';
import { getOrFetchDetails, cachedBoxartUrl } from '@/services/game-details/index.js';
import { fetchBoxart } from '@/services/game-details/libretro.js';
import { errorJson, errorMessage, parseJsonBody } from '@/lib/http.js';

export const gameDetailsRoute = new Hono();

gameDetailsRoute.post('/dats/:id/games/details', async (c) => {
  const datId = c.req.param('id');
  const dat = getDat(datId);
  if (dat == null) {
    return errorJson(c, 404, 'NOT_FOUND', `DAT ${datId} not found`);
  }

  const body = await parseJsonBody(c, gameDetailsRequestSchema);
  if (!body.ok) return body.response;

  try {
    const details = await getOrFetchDetails(datId, dat, body.data.gameIds);
    return c.json({ details });
  } catch (err) {
    return errorJson(c, 502, 'PROVIDER_ERROR', errorMessage(err, 'Details fetch failed'));
  }
});

// The browser loads boxarts from here, never from the provider directly.
// Only URLs we built and cached ourselves are fetched — the route never
// proxies caller-supplied URLs.
gameDetailsRoute.get('/dats/:id/games/:gameId/boxart', async (c) => {
  const url = cachedBoxartUrl(c.req.param('id'), c.req.param('gameId'));
  if (url == null) {
    return errorJson(c, 404, 'NOT_FOUND', 'No boxart for this game');
  }

  let upstream: Response;
  try {
    upstream = await fetchBoxart(url);
  } catch (err) {
    return errorJson(c, 502, 'PROVIDER_ERROR', errorMessage(err, 'Boxart fetch failed'));
  }
  if (!upstream.ok || upstream.body == null) {
    return errorJson(c, 502, 'PROVIDER_ERROR', `Boxart fetch failed: ${upstream.status}`);
  }

  return c.body(upstream.body, 200, {
    'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
    // Thumbnails are immutable in practice; let the browser cache hard.
    'Cache-Control': 'public, max-age=604800, immutable',
  });
});
