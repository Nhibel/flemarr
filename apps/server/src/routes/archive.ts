import { Hono } from 'hono';
import { z } from 'zod';
import {
  addSourceRequestSchema,
  indexRequestSchema,
  resolveRequestSchema,
} from '@shared/archive.js';
import {
  getSources,
  getAllSystems,
  addSource,
  removeSource,
} from '@/services/archive-org/sources.js';
import { getIndex } from '@/services/archive-org/metadata.js';
import { resolveGames } from '@/services/archive-org/resolver.js';
import { getDat } from '@/services/dat/index.js';

export const archiveRoute = new Hono();

// List sources for a system (or all systems if no query param)
archiveRoute.get('/archive/sources', (c) => {
  const system = c.req.query('system');
  if (system) {
    return c.json({ system, sources: getSources(system) });
  }
  const all: Record<string, ReturnType<typeof getSources>> = {};
  for (const s of getAllSystems()) {
    all[s] = getSources(s);
  }
  return c.json({ systems: all });
});

// Add a source
archiveRoute.post('/archive/sources', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = addSourceRequestSchema.safeParse(body);
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

  addSource(parsed.data.system, parsed.data.source);
  return c.json({ ok: true }, 201);
});

// Remove a source by identifier
archiveRoute.delete('/archive/sources/:identifier', (c) => {
  const identifier = c.req.param('identifier');
  const removed = removeSource(identifier);
  if (!removed) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Source ${identifier} not found` } }, 404);
  }
  return c.json({ ok: true });
});

// Preview what's in an archive.org identifier
archiveRoute.post('/archive/index', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = indexRequestSchema.safeParse(body);
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

  let files;
  try {
    files = await getIndex(parsed.data.identifier);
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'FETCH_ERROR',
          message: err instanceof Error ? err.message : 'Failed to fetch index',
        },
      },
      502,
    );
  }

  return c.json({
    identifier: parsed.data.identifier,
    fileCount: files.length,
    preview: files.slice(0, 20),
  });
});

// Search archive.org for candidate identifiers
archiveRoute.get('/archive/search', async (c) => {
  const q = c.req.query('q');
  if (!q?.trim()) {
    return c.json(
      { error: { code: 'MISSING_QUERY', message: 'Query parameter q is required' } },
      400,
    );
  }

  const searchSchema = z.object({
    response: z.object({
      docs: z.array(
        z.object({
          identifier: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
        }),
      ),
    }),
  });

  const url =
    `https://archive.org/advancedsearch.php?` +
    `q=${encodeURIComponent(q)}&output=json&rows=20` +
    `&fl[]=identifier&fl[]=title&fl[]=description` +
    `&sort[]=downloads+desc`;

  let results;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`archive.org search returned ${res.status}`);
    const raw: unknown = await res.json();
    const parsed2 = searchSchema.safeParse(raw);
    if (!parsed2.success) throw new Error('Unexpected search response shape');
    results = parsed2.data.response.docs.map((d) => ({
      identifier: d.identifier,
      title: d.title ?? d.identifier,
      description: d.description ?? '',
    }));
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'FETCH_ERROR',
          message: err instanceof Error ? err.message : 'Search failed',
        },
      },
      502,
    );
  }

  return c.json({ results });
});

// Resolve selected games to download URLs
archiveRoute.post('/archive/resolve', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = resolveRequestSchema.safeParse(body);
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

  const dat = getDat(parsed.data.datId);
  if (!dat) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: `DAT ${parsed.data.datId} not found` } },
      404,
    );
  }

  const results = await resolveGames(dat, parsed.data.datId, parsed.data.gameIds);
  return c.json({ results });
});
