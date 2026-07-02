import { Hono } from 'hono';
import { logger } from '@/lib/logger.js';
import { healthRoute } from '@/routes/health.js';
import { datsRoute } from '@/routes/dats.js';
import { scanRoute } from '@/routes/scan.js';
import { archiveRoute } from '@/routes/archive.js';
import { downloadsRoute } from '@/routes/downloads.js';
import { fresh1g1rRoute } from '@/routes/fresh1g1r.js';
import { settingsRoute } from '@/routes/settings.js';
import { fsRoute } from '@/routes/fs.js';

export const app = new Hono();

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  logger.info(
    { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start },
    'request',
  );
});

app.route('/api', healthRoute);
app.route('/api', datsRoute);
app.route('/api', scanRoute);
app.route('/api', archiveRoute);
app.route('/api', downloadsRoute);
app.route('/api', fresh1g1rRoute);
app.route('/api', settingsRoute);
app.route('/api', fsRoute);
