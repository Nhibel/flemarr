import { describe, it, expect, vi } from 'vitest';
import { KEEP_ALIVE_MS, streamJobEvents } from '../lib/job-event-stream.js';

interface FakeJob {
  events: unknown[];
  finished: boolean;
}

/**
 * A stream whose sleep advances a fake clock and lets the test change the
 * job between polls, so no real time passes.
 */
function fakeStream(onPoll: (elapsedMs: number) => void) {
  let clock = 0;
  const written: string[] = [];
  const stream = {
    writeSSE: vi.fn(async (message: { data: string }) => {
      written.push(`data: ${message.data}`);
    }),
    write: vi.fn(async (input: string | Uint8Array) => {
      written.push(String(input));
      return stream as never;
    }),
    sleep: vi.fn(async (ms: number) => {
      clock += ms;
      onPoll(clock);
    }),
  };
  return { stream, written, now: () => clock };
}

describe('streamJobEvents', () => {
  it('sends every event once, then stops when the job is finished', async () => {
    const job: FakeJob = { events: [{ n: 1 }], finished: false };
    const { stream, written, now } = fakeStream(() => {
      job.events.push({ n: 2 });
      job.finished = true;
    });
    await streamJobEvents(stream, 'j1', () => job, (j) => j.finished, now);
    expect(written).toEqual(['data: {"n":1}', 'data: {"n":2}']);
  });

  it('reports an unknown job', async () => {
    const { stream, written, now } = fakeStream(() => {});
    await streamJobEvents(stream, 'nope', () => undefined, () => true, now);
    expect(written).toEqual(['data: {"type":"error","message":"Job nope not found"}']);
  });

  // Cloudflare cuts a connection idle for ~100 s.
  it('pings a silent stream every 30 s', async () => {
    const job: FakeJob = { events: [], finished: false };
    const { stream, written, now } = fakeStream((elapsed) => {
      if (elapsed >= 95_000) job.finished = true;
    });
    await streamJobEvents(stream, 'j1', () => job, (j) => j.finished, now);
    expect(written).toEqual([': ping\n\n', ': ping\n\n', ': ping\n\n']);
  });

  it('does not ping while events keep flowing', async () => {
    const job: FakeJob = { events: [], finished: false };
    const { stream, written, now } = fakeStream((elapsed) => {
      if (elapsed % 10_000 === 0) job.events.push({ at: elapsed });
      if (elapsed >= KEEP_ALIVE_MS * 2) job.finished = true;
    });
    await streamJobEvents(stream, 'j1', () => job, (j) => j.finished, now);
    expect(written.some((line) => line.startsWith(':'))).toBe(false);
  });
});
