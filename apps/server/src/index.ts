import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { healthRoute } from '@/routes/health.js';
import { datsRoute } from '@/routes/dats.js';
import { scanRoute } from '@/routes/scan.js';
import { archiveRoute } from '@/routes/archive.js';
import { downloadsRoute } from '@/routes/downloads.js';

const app = new Hono();

app.route('/api', healthRoute);
app.route('/api', datsRoute);
app.route('/api', scanRoute);
app.route('/api', archiveRoute);
app.route('/api', downloadsRoute);

const PORT = Number(process.env['PORT'] ?? 3000);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
