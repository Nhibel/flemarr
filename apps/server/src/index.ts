import { serve } from '@hono/node-server';
import { app } from '@/app.js';
import { closeDb } from '@/lib/db.js';

const PORT = Number(process.env['PORT'] ?? 3000);

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Open SSE streams can hold the server open indefinitely — force exit after grace period
  setTimeout(() => {
    closeDb();
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
