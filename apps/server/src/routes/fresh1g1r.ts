import { Hono } from 'hono';
import { fresh1g1rPresetSchema, fetchDatRequestSchema } from '@shared/fresh1g1r.js';
import { listDatSources, fetchDat } from '@/services/fresh1g1r/index.js';

export const fresh1g1rRoute = new Hono();

fresh1g1rRoute.get('/dat-sources', async (c) => {
  const rawPreset = c.req.query('preset') ?? 'PropeR';
  const parsed = fresh1g1rPresetSchema.safeParse(rawPreset);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'INVALID_PRESET',
          message: `Unknown preset: ${rawPreset}. Use PropeR, McLean or Hearto.`,
        },
      },
      400,
    );
  }

  let sources;
  try {
    sources = await listDatSources(parsed.data);
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'GITHUB_ERROR',
          message: err instanceof Error ? err.message : 'GitHub fetch failed',
        },
      },
      502,
    );
  }

  return c.json({ preset: parsed.data, sources });
});

fresh1g1rRoute.post('/dats/from-fresh1g1r', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = fetchDatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
        },
      },
      400,
    );
  }

  let summary;
  try {
    summary = await fetchDat(parsed.data.preset, parsed.data.path, parsed.data.sha);
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'FETCH_ERROR',
          message: err instanceof Error ? err.message : 'DAT fetch failed',
        },
      },
      502,
    );
  }

  return c.json(summary, 201);
});
