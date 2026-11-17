import { Hono } from 'hono';
import { systemIconsRequestSchema } from '@shared/system-icon.js';
import { getSystemIcons, systemIconUrl } from '@/services/system-icon/index.js';
import { errorJson, errorMessage, parseJsonBody } from '@/lib/http.js';

export const systemIconsRoute = new Hono();

// A POST with the systems in the body, not a GET per system: the home screen
// shows every loaded system at once and asks for the whole set in one call.
systemIconsRoute.post('/systems/icons', async (c) => {
  const body = await parseJsonBody(c, systemIconsRequestSchema);
  if (!body.ok) return body.response;

  try {
    return c.json({ icons: await getSystemIcons(body.data.systems) });
  } catch (err) {
    return errorJson(c, 502, 'PROVIDER_ERROR', errorMessage(err, 'System icon lookup failed'));
  }
});

// The browser loads icons from here, never from the provider directly. Only
// URLs built from the pinned name index are fetched — the route never proxies
// a caller-supplied URL. The system travels as a query parameter because the
// names contain '&', '_' and spaces, and a few contain a slash.
systemIconsRoute.get('/systems/icon', async (c) => {
  const system = c.req.query('system');
  if (system === undefined || system === '') {
    return errorJson(c, 400, 'VALIDATION_ERROR', 'system is required');
  }

  let url: string | null;
  try {
    url = await systemIconUrl(system);
  } catch (err) {
    return errorJson(c, 502, 'PROVIDER_ERROR', errorMessage(err, 'System icon lookup failed'));
  }
  if (url === null) {
    return errorJson(c, 404, 'NOT_FOUND', 'No icon for this system');
  }

  let upstream: Response;
  try {
    upstream = await fetch(url);
  } catch (err) {
    return errorJson(c, 502, 'PROVIDER_ERROR', errorMessage(err, 'System icon fetch failed'));
  }
  if (!upstream.ok || upstream.body === null) {
    return errorJson(c, 502, 'PROVIDER_ERROR', `System icon fetch failed: ${upstream.status}`);
  }

  return c.body(upstream.body, 200, {
    'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
    // The URL names a pinned commit, so these bytes can never change.
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
});
