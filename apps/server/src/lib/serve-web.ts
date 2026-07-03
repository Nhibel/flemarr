import type { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

/**
 * Serve the built web SPA from `webRoot` on the same Hono app that already
 * hosts the API (ARCHITECTURE.md: in production Hono serves static files at
 * `/` and the API at `/api/*` on one port). Call this AFTER the `/api` routes
 * are mounted so a matched API route always wins.
 *
 * `serveStatic` accepts an absolute root and rejects `..`/`//` traversal
 * itself. Real files (index.html at `/`, hashed JS/CSS under /assets, …) are
 * served directly; any other non-API GET falls back to index.html so client
 * routing and deep links resolve.
 */
export function serveWeb(app: Hono, webRoot: string): void {
  app.on(['GET', 'HEAD'], '*', serveStatic({ root: webRoot }));

  app.get('*', (c, next) => {
    // Unknown /api/* must 404, not receive index.html.
    if (c.req.path.startsWith('/api/')) return next();
    return serveStatic({ path: 'index.html', root: webRoot })(c, next);
  });
}
