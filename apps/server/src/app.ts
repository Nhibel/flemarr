import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { logger } from '@/lib/logger.js';
import { runWithRequestId } from '@/lib/request-context.js';
import { errorJson, errorMessage } from '@/lib/http.js';
import { healthRoute } from '@/routes/health.js';
import { datsRoute } from '@/routes/dats.js';
import { scanRoute } from '@/routes/scan.js';
import { gameLinksRoute } from '@/routes/game-links.js';
import { archiveRoute } from '@/routes/archive.js';
import { downloadsRoute } from '@/routes/downloads.js';
import { fresh1g1rRoute } from '@/routes/fresh1g1r.js';
import { settingsRoute } from '@/routes/settings.js';
import { fsRoute } from '@/routes/fs.js';
import { gameDetailsRoute } from '@/routes/game-details.js';
import { systemIconsRoute } from '@/routes/system-icons.js';

export const app = new Hono();

// Polled by healthchecks and monitors: not worth a line each.
const QUIET_PATH = '/api/health';

app.use('*', (c, next) => {
  const requestId = randomUUID();
  c.header('X-Request-Id', requestId);
  return runWithRequestId(requestId, next);
});

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const level = c.req.path === QUIET_PATH ? 'debug' : 'info';
  logger[level](
    { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start },
    'request',
  );
});

// Safety net for any route that forgets a try/catch: without this, an
// uncaught exception falls through to Hono's default plain-text 500,
// breaking the uniform { error: { code, message } } envelope every client
// relies on (see docs/ARCHITECTURE.md). Routes that need a specific error
// code should still catch and classify their own errors — this only
// guarantees the envelope's shape for whatever slips through.
app.onError((err, c) => {
  logger.error({ method: c.req.method, path: c.req.path, err }, 'unhandled error');
  return errorJson(c, 500, 'INTERNAL_ERROR', errorMessage(err, 'Internal server error'));
});

app.route('/api', healthRoute);
app.route('/api', datsRoute);
app.route('/api', scanRoute);
app.route('/api', gameLinksRoute);
app.route('/api', archiveRoute);
app.route('/api', downloadsRoute);
app.route('/api', fresh1g1rRoute);
app.route('/api', settingsRoute);
app.route('/api', fsRoute);
app.route('/api', gameDetailsRoute);
app.route('/api', systemIconsRoute);
