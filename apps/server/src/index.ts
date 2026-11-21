import { serve } from '@hono/node-server';
import { app } from '@/app.js';
import { closeDb, dataDir } from '@/lib/db.js';
import { serveWeb } from '@/lib/serve-web.js';
import { libraryRoot } from '@/lib/library-root.js';

const PORT = Number(process.env['PORT'] ?? 3000);

// In production the built SPA is served by this same process (WEB_ROOT points
// at the web build). Unset in dev, where Vite serves the UI and proxies /api.
const WEB_ROOT = process.env['WEB_ROOT'];
if (WEB_ROOT) {
  serveWeb(app, WEB_ROOT);
}

// Startup banner — visible in `docker logs` / Portainer to confirm the
// container picked up its configuration (port, library root, data dir).
const romsRoot = libraryRoot();
console.log('Flemarr: starting…');
console.log(`  port:      ${PORT}`);
console.log(
  `  ROM root:  ${romsRoot ?? '(ROMS_ROOT not set — directory browsing is not confined)'}`,
);
console.log(`  data dir:  ${dataDir()}`);
console.log(
  `  web UI:    ${WEB_ROOT ? `served from ${WEB_ROOT}` : '(not set — dev mode, served by Vite)'}`,
);

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Flemarr: ready — http://localhost:${info.port}`);
});

function shutdown(signal: string): void {
  console.log(`Flemarr: ${signal} received, shutting down`);
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
