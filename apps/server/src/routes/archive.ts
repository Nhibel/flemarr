import { Hono } from 'hono';
import {
  addSourceRequestSchema,
  indexRequestSchema,
  resolveRequestSchema,
  suggestRequestSchema,
  archiveLoginRequestSchema,
} from '@shared/archive.js';
import { exchangeArchiveLogin, ArchiveLoginError } from '@/services/archive-org/login.js';
import {
  getSources,
  getAllSystems,
  addSource,
  removeSource,
} from '@/services/archive-org/sources.js';
import { getIndex } from '@/services/archive-org/metadata.js';
import { detectLayout } from '@/services/archive-org/layout.js';
import { searchArchive } from '@/services/archive-org/search.js';
import { suggestSources } from '@/services/archive-org/suggest.js';
import { resolveGames, clearResolverCache } from '@/services/archive-org/resolver.js';
import { getDat } from '@/services/dat/index.js';
import { errorJson, errorMessage, parseJsonBody } from '@/lib/http.js';

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
  const body = await parseJsonBody(c, addSourceRequestSchema);
  if (!body.ok) return body.response;

  addSource(body.data.system, body.data.source);
  // Cached resolve results are stale as soon as the source list changes
  clearResolverCache();
  return c.json({ ok: true }, 201);
});

// Remove a source. An identifier can be registered for several systems
// (migration005), so the system scopes the deletion — without it, dropping a
// multi-system collection from one system would remove it from all of them.
archiveRoute.delete('/archive/sources/:identifier', (c) => {
  const identifier = c.req.param('identifier');
  const system = c.req.query('system');
  if (!system?.trim()) {
    return errorJson(c, 400, 'MISSING_SYSTEM', 'Query parameter system is required');
  }
  const removed = removeSource(identifier, system);
  if (!removed) {
    return errorJson(c, 404, 'NOT_FOUND', `Source ${identifier} not found for ${system}`);
  }
  clearResolverCache();
  return c.json({ ok: true });
});

// Preview what's in an archive.org identifier
archiveRoute.post('/archive/index', async (c) => {
  const body = await parseJsonBody(c, indexRequestSchema);
  if (!body.ok) return body.response;

  let files;
  try {
    files = await getIndex(body.data.identifier);
  } catch (err) {
    return errorJson(c, 502, 'FETCH_ERROR', errorMessage(err, 'Failed to fetch index'));
  }

  return c.json({
    identifier: body.data.identifier,
    fileCount: files.length,
    preview: files.slice(0, 20),
    suggestedLayout: detectLayout(files),
  });
});

// Search archive.org for candidate identifiers
archiveRoute.get('/archive/search', async (c) => {
  const q = c.req.query('q');
  if (!q?.trim()) {
    return errorJson(c, 400, 'MISSING_QUERY', 'Query parameter q is required');
  }

  let results;
  try {
    results = await searchArchive(q.trim());
  } catch (err) {
    return errorJson(c, 502, 'FETCH_ERROR', errorMessage(err, 'Search failed'));
  }

  return c.json({ results });
});

// Exchange archive.org email+password for API keys and session cookies.
// The password transits here once and is never stored.
archiveRoute.post('/archive/login', async (c) => {
  const body = await parseJsonBody(c, archiveLoginRequestSchema);
  if (!body.ok) return body.response;

  try {
    await exchangeArchiveLogin(body.data.email, body.data.password);
  } catch (err) {
    if (err instanceof ArchiveLoginError) {
      return errorJson(c, 401, 'LOGIN_FAILED', err.message);
    }
    return errorJson(c, 502, 'FETCH_ERROR', errorMessage(err, 'Login exchange failed'));
  }

  return c.json({ ok: true });
});

// Suggest sources for a DAT: search + score candidates against the DAT
archiveRoute.post('/archive/suggest', async (c) => {
  const body = await parseJsonBody(c, suggestRequestSchema);
  if (!body.ok) return body.response;

  const dat = getDat(body.data.datId);
  if (!dat) {
    return errorJson(c, 404, 'NOT_FOUND', `DAT ${body.data.datId} not found`);
  }

  let suggestions;
  try {
    suggestions = await suggestSources(dat);
  } catch (err) {
    return errorJson(c, 502, 'FETCH_ERROR', errorMessage(err, 'Suggestion failed'));
  }

  return c.json({ suggestions });
});

// Resolve selected games to download URLs
archiveRoute.post('/archive/resolve', async (c) => {
  const body = await parseJsonBody(c, resolveRequestSchema);
  if (!body.ok) return body.response;

  const dat = getDat(body.data.datId);
  if (!dat) {
    return errorJson(c, 404, 'NOT_FOUND', `DAT ${body.data.datId} not found`);
  }

  const results = await resolveGames(dat, body.data.datId, body.data.gameIds);
  return c.json({ results });
});
