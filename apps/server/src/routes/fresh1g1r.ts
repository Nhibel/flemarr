import { Hono } from 'hono';
import { fresh1g1rPresetSchema, fetchDatRequestSchema } from '@shared/fresh1g1r.js';
import { listDatSources, fetchDat } from '@/services/fresh1g1r/index.js';
import { findDatUpdates, forgetDatUpdates } from '@/services/fresh1g1r/updates.js';
import { clearResolverCache } from '@/services/archive-org/resolver.js';
import { errorJson, errorMessage, parseJsonBody } from '@/lib/http.js';

export const fresh1g1rRoute = new Hono();

fresh1g1rRoute.get('/dat-sources', async (c) => {
  const rawPreset = c.req.query('preset') ?? 'PropeR';
  const parsed = fresh1g1rPresetSchema.safeParse(rawPreset);
  if (!parsed.success) {
    return errorJson(
      c,
      400,
      'INVALID_PRESET',
      `Unknown preset: ${rawPreset}. Use PropeR, McLean or Hearto.`,
    );
  }

  let sources;
  try {
    sources = await listDatSources(parsed.data);
  } catch (err) {
    return errorJson(c, 502, 'GITHUB_ERROR', errorMessage(err, 'GitHub fetch failed'));
  }

  return c.json({ preset: parsed.data, sources });
});

// Loaded DATs with a newer set version on Fresh1G1R.
fresh1g1rRoute.get('/dats/updates', async (c) => {
  try {
    return c.json({ updates: await findDatUpdates() });
  } catch (err) {
    return errorJson(c, 502, 'GITHUB_ERROR', errorMessage(err, 'Update check failed'));
  }
});

fresh1g1rRoute.post('/dats/from-fresh1g1r', async (c) => {
  const body = await parseJsonBody(c, fetchDatRequestSchema);
  if (!body.ok) return body.response;

  let summary;
  try {
    summary = await fetchDat(body.data.preset, body.data.path, body.data.revision);
  } catch (err) {
    return errorJson(c, 502, 'FETCH_ERROR', errorMessage(err, 'DAT fetch failed'));
  }

  // Same reasoning as POST /dats — a reload can change games/roms for the
  // same DAT id, and the resolver's cache doesn't know that on its own.
  clearResolverCache();
  forgetDatUpdates();
  return c.json(summary, 201);
});
