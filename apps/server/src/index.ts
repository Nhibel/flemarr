import { serve } from '@hono/node-server';
import { app } from '@/app.js';
import { closeDb, dataDir } from '@/lib/db.js';
import { serveWeb } from '@/lib/serve-web.js';
import { logger } from '@/lib/logger.js';
import { warnIfNotWritable } from '@/lib/startup-checks.js';
import { libraryRoot } from '@/lib/library-root.js';

const PORT = Number(process.env['PORT'] ?? 3000);

// In production the built SPA is served by this same process (WEB_ROOT points
// at the web build). Unset in dev, where Vite serves the UI and proxies /api.
const WEB_ROOT = process.env['WEB_ROOT'];
if (WEB_ROOT) {
  serveWeb(app, WEB_ROOT);
}

// Startup summary — visible in `docker logs` / Portainer to confirm the
// container picked up its configuration (port, library root, data dir).
const romsRoot = libraryRoot();
logger.info(
  {
    version: process.env['APP_VERSION'] ?? 'dev',
    node: process.version,
    port: PORT,
    logLevel: logger.level,
    // null: ROMS_ROOT not set, directory browsing is not confined
    romsRoot,
    dataDir: dataDir(),
    // null: dev mode, the UI is served by Vite
    webRoot: WEB_ROOT ?? null,
  },
  'Flemarr starting',
);
if (romsRoot !== null) warnIfNotWritable(romsRoot);

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  logger.info({ port: info.port }, 'Flemarr ready');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Flemarr shutting down');
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

// The state after either is unknown: log the cause, then let Docker restart.
function crash(err: unknown, message: string): void {
  logger.fatal({ err }, message);
  process.exit(1);
}

process.on('uncaughtException', (err) => crash(err, 'uncaught exception'));
process.on('unhandledRejection', (reason) => crash(reason, 'unhandled rejection'));
