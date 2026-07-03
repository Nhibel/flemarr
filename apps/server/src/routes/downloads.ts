import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { downloadRequestSchema } from '@shared/download.js';
import { startDownload, cancelJob, downloadJobs } from '@/services/downloader/index.js';
import { PathTraversalError, NoRootsConfiguredError } from '@/lib/fs-safety.js';
import { errorJson, errorMessage, parseJsonBody } from '@/lib/http.js';

export const downloadsRoute = new Hono();

downloadsRoute.post('/downloads', async (c) => {
  const body = await parseJsonBody(c, downloadRequestSchema);
  if (!body.ok) return body.response;

  let jobId: string;
  try {
    jobId = await startDownload(body.data);
  } catch (err) {
    if (err instanceof NoRootsConfiguredError) {
      return errorJson(c, 400, 'NO_ROOTS_CONFIGURED', err.message);
    }
    if (err instanceof PathTraversalError) {
      return errorJson(c, 400, 'PATH_TRAVERSAL', err.message);
    }
    return errorJson(c, 500, 'START_ERROR', errorMessage(err, 'Failed to start download'));
  }

  return c.json({ jobId }, 202);
});

downloadsRoute.get('/downloads/:jobId/events', (c) => {
  const jobId = c.req.param('jobId');

  return streamSSE(c, async (stream) => {
    let lastSent = 0;

    const send = async (event: unknown) => {
      await stream.writeSSE({ data: JSON.stringify(event) });
    };

    while (true) {
      const job = downloadJobs.get(jobId);
      if (job === undefined) {
        await send({ type: 'error', message: `Job ${jobId} not found` });
        return;
      }

      while (lastSent < job.events.length) {
        await send(job.events[lastSent]);
        lastSent++;
      }

      if (job.status === 'done' || job.status === 'cancelled') return;

      await stream.sleep(100);
    }
  });
});

downloadsRoute.post('/downloads/:jobId/cancel', async (c) => {
  const jobId = c.req.param('jobId');
  const cancelled = await cancelJob(jobId);

  if (!cancelled) {
    return errorJson(c, 404, 'NOT_FOUND', `Job ${jobId} not found or already finished`);
  }

  return c.json({ ok: true });
});
