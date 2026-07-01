import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { scanRequestSchema, renameRequestSchema } from '@shared/scan.js';
import { runScan, scanJobs } from '@/services/scanner/index.js';
import { assertWithinRoot, PathTraversalError } from '@/lib/fs-safety.js';

export const scanRoute = new Hono();

scanRoute.post('/scan', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = scanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const { datId, directory } = parsed.data;

  let jobId: string;
  try {
    jobId = await runScan(datId, directory);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed';
    const code = message.includes('not found') ? 'NOT_FOUND' : 'SCAN_ERROR';
    return c.json({ error: { code, message } }, code === 'NOT_FOUND' ? 404 : 500);
  }

  return c.json({ jobId }, 202);
});

scanRoute.get('/scan/:jobId/events', (c) => {
  const jobId = c.req.param('jobId');

  return streamSSE(c, async (stream) => {
    let lastSent = 0;

    const send = async (event: unknown) => {
      await stream.writeSSE({ data: JSON.stringify(event) });
    };

    // Poll the job's event buffer and flush new events to the SSE stream
    while (true) {
      const job = scanJobs.get(jobId);
      if (job === undefined) {
        await send({ type: 'error', message: `Job ${jobId} not found` });
        return;
      }

      while (lastSent < job.events.length) {
        await send(job.events[lastSent]);
        lastSent++;
      }

      if (job.status === 'done' || job.status === 'error') return;

      await stream.sleep(100);
    }
  });
});

scanRoute.post('/scan/rename', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = renameRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const { renames, root } = parsed.data;

  // Validate all paths before touching the filesystem
  for (const { from, to } of renames) {
    try {
      assertWithinRoot(from, root);
      assertWithinRoot(join(dirname(from), to), root);
    } catch (err) {
      if (err instanceof PathTraversalError) {
        return c.json({ error: { code: 'PATH_TRAVERSAL', message: err.message } }, 400);
      }
      throw err;
    }
  }

  const done: typeof renames = [];
  const failed: { entry: (typeof renames)[0]; error: string }[] = [];
  const rolledBack: string[] = [];

  for (const entry of renames) {
    const { from, to } = entry;
    const dest = join(dirname(from), to);
    try {
      await rename(from, dest);
      done.push(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ entry, error: message });

      // Best-effort rollback of already-completed renames
      for (const completed of done) {
        const completedDest = join(dirname(completed.from), completed.to);
        try {
          await rename(completedDest, completed.from);
          rolledBack.push(completed.from);
        } catch {
          // best-effort — log but continue
        }
      }
      break;
    }
  }

  const status = failed.length === 0 ? 200 : 500;
  return c.json({ done, failed, rolledBack }, status);
});
