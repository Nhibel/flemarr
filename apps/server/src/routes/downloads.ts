import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { downloadRequestSchema } from '@shared/download.js';
import { startDownload, cancelJob, downloadJobs } from '@/services/downloader/index.js';

export const downloadsRoute = new Hono();

downloadsRoute.post('/downloads', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = downloadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
        },
      },
      400,
    );
  }

  let jobId: string;
  try {
    jobId = await startDownload(parsed.data);
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'START_ERROR',
          message: err instanceof Error ? err.message : 'Failed to start download',
        },
      },
      500,
    );
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
    return c.json(
      { error: { code: 'NOT_FOUND', message: `Job ${jobId} not found or already finished` } },
      404,
    );
  }

  return c.json({ ok: true });
});
