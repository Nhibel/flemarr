import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { healthRoute } from '@/routes/health.js';

const app = new Hono();

app.route('/api', healthRoute);

const PORT = Number(process.env['PORT'] ?? 3000);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
