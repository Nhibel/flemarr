import { Hono } from 'hono';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { streamJobEvents } from '@/lib/job-event-stream.js';
import { scanRequestSchema, renameRequestSchema } from '@shared/scan.js';
import { runScan, scanJobs } from '@/services/scanner/index.js';
import { getLastScan } from '@/services/scanner/last-scan.js';
import { renameDestination, renameWithRollback } from '@/services/scanner/rename.js';
import {
  assertWithinConfiguredRoots,
  PathTraversalError,
  NoRootsConfiguredError,
} from '@/lib/fs-safety.js';
import { libraryRoots } from '@/lib/library-root.js';
import { errorJson, errorMessage, parseJsonBody } from '@/lib/http.js';

export const scanRoute = new Hono();

function configuredRoots(): string[] {
  return libraryRoots();
}

function rollbackNote(rolledBackCount: number): string {
  if (rolledBackCount === 0) return '';
  const files = rolledBackCount > 1 ? 'files' : 'file';
  return ` (rolled back ${rolledBackCount} already-renamed ${files})`;
}

function rootsErrorResponse(c: Context, err: unknown): Response | null {
  if (err instanceof NoRootsConfiguredError) {
    return errorJson(c, 400, 'NO_ROOTS_CONFIGURED', err.message);
  }
  if (err instanceof PathTraversalError) {
    return errorJson(c, 400, 'PATH_TRAVERSAL', err.message);
  }
  return null;
}

scanRoute.post('/scan', async (c) => {
  const body = await parseJsonBody(c, scanRequestSchema);
  if (!body.ok) return body.response;

  const { datId, directory } = body.data;

  try {
    assertWithinConfiguredRoots(directory, configuredRoots());
  } catch (err) {
    const known = rootsErrorResponse(c, err);
    if (known) return known;
    throw err;
  }

  let jobId: string;
  try {
    jobId = await runScan(datId, directory);
  } catch (err) {
    const message = errorMessage(err, 'Scan failed');
    if (message.includes('not found')) return errorJson(c, 404, 'NOT_FOUND', message);
    return errorJson(c, 500, 'SCAN_ERROR', message);
  }

  return c.json({ jobId }, 202);
});

// The DAT's last finished scan, null when it was never scanned.
scanRoute.get('/dats/:id/last-scan', (c) => {
  return c.json({ lastScan: getLastScan(c.req.param('id')) });
});

scanRoute.get('/scan/:jobId/events', (c) => {
  const jobId = c.req.param('jobId');

  return streamSSE(c, (stream) =>
    streamJobEvents(
      stream,
      jobId,
      (id) => scanJobs.get(id),
      (job) => job.status === 'done' || job.status === 'error',
    ),
  );
});

scanRoute.post('/scan/rename', async (c) => {
  const body = await parseJsonBody(c, renameRequestSchema);
  if (!body.ok) return body.response;

  const { renames } = body.data;
  const roots = configuredRoots();

  // Validate all paths before touching the filesystem
  for (const { from, to } of renames) {
    try {
      assertWithinConfiguredRoots(from, roots);
      assertWithinConfiguredRoots(renameDestination({ from, to }), roots);
    } catch (err) {
      const known = rootsErrorResponse(c, err);
      if (known) return known;
      throw err;
    }
  }

  const result = await renameWithRollback(renames);
  const firstFailure = result.failed[0];
  if (firstFailure) {
    return errorJson(
      c,
      500,
      'RENAME_FAILED',
      `Rename failed for "${firstFailure.entry.from}": ${firstFailure.error}${rollbackNote(result.rolledBack.length)}`,
      result,
    );
  }

  return c.json(result);
});
