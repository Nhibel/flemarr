import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { healthRoute } from '@/routes/health.js';
import { datsRoute } from '@/routes/dats.js';
import { scanRoute } from '@/routes/scan.js';
import { archiveRoute } from '@/routes/archive.js';
import { downloadsRoute } from '@/routes/downloads.js';
import { fresh1g1rRoute } from '@/routes/fresh1g1r.js';
import { settingsRoute } from '@/routes/settings.js';

const app = new Hono();

app.route('/api', healthRoute);
app.route('/api', datsRoute);
app.route('/api', scanRoute);
app.route('/api', archiveRoute);
app.route('/api', downloadsRoute);
app.route('/api', fresh1g1rRoute);
app.route('/api', settingsRoute);

const PORT = Number(process.env['PORT'] ?? 3000);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
