import type { SSEStreamingApi } from 'hono/streaming';

const POLL_MS = 100;

// Cloudflare drops a proxied connection that carries no byte for ~100 s. A
// CHD conversion or a slow file can stay that long without an event, so a
// silent stream gets an SSE comment line, which EventSource ignores.
export const KEEP_ALIVE_MS = 30_000;

interface EventJob {
  events: readonly unknown[];
}

/** The calls the loop makes on a Hono SSE stream. */
type JobStream = Pick<SSEStreamingApi, 'writeSSE' | 'write' | 'sleep'>;

/**
 * Streams a job's buffered events as they arrive, until the job is
 * finished. An unknown job gets one error event. Shared by the download
 * and scan event routes.
 */
export async function streamJobEvents<Job extends EventJob>(
  stream: JobStream,
  jobId: string,
  findJob: (jobId: string) => Job | undefined,
  isFinished: (job: Job) => boolean,
  now: () => number = Date.now,
): Promise<void> {
  let lastSent = 0;
  let lastWrite = now();

  const send = async (event: unknown) => {
    await stream.writeSSE({ data: JSON.stringify(event) });
    lastWrite = now();
  };

  for (;;) {
    const job = findJob(jobId);
    if (job === undefined) {
      await send({ type: 'error', message: `Job ${jobId} not found` });
      return;
    }

    while (lastSent < job.events.length) {
      await send(job.events[lastSent]);
      lastSent++;
    }

    if (isFinished(job)) return;

    if (now() - lastWrite >= KEEP_ALIVE_MS) {
      await stream.write(': ping\n\n');
      lastWrite = now();
    }
    await stream.sleep(POLL_MS);
  }
}
