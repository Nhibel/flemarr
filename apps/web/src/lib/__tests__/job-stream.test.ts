import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openJobStream } from '../job-stream.js';

class FakeEventSource {
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

let sources: FakeEventSource[];

beforeEach(() => {
  vi.useFakeTimers();
  sources = [];
});
afterEach(() => {
  vi.useRealTimers();
});

const latest = () => sources.at(-1)!;

function openStream() {
  const handlers = { onMessage: vi.fn(), onReplay: vi.fn(), onLost: vi.fn() };
  const stream = openJobStream({
    open: () => {
      const source = new FakeEventSource();
      sources.push(source);
      return source as unknown as EventSource;
    },
    ...handlers,
  });
  return { stream, ...handlers };
}

describe('openJobStream', () => {
  it('reopens a cut stream and announces the replay once', () => {
    const { onMessage, onReplay, onLost } = openStream();
    latest().onmessage!({ data: 'a' });
    expect(onReplay).not.toHaveBeenCalled();

    latest().onerror!();
    vi.advanceTimersByTime(1000);
    expect(sources).toHaveLength(2);
    latest().onmessage!({ data: 'a' });
    latest().onmessage!({ data: 'b' });

    expect(onReplay).toHaveBeenCalledOnce();
    expect(onMessage.mock.calls.map(([data]) => data)).toEqual(['a', 'a', 'b']);
    expect(onLost).not.toHaveBeenCalled();
  });

  it('gives up after five failed attempts', () => {
    const { onLost } = openStream();
    for (let failure = 0; failure < 5; failure++) {
      latest().onerror!();
      vi.advanceTimersByTime(16_000);
    }
    expect(onLost).not.toHaveBeenCalled();
    latest().onerror!();
    expect(onLost).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000);
    expect(sources).toHaveLength(6);
  });

  it('starts counting again once a message came through', () => {
    const { onLost } = openStream();
    for (let cut = 0; cut < 10; cut++) {
      latest().onerror!();
      vi.advanceTimersByTime(1000);
      latest().onmessage!({ data: 'x' });
    }
    expect(onLost).not.toHaveBeenCalled();
  });

  it('never reopens once closed', () => {
    const { stream } = openStream();
    latest().onerror!();
    stream.close();
    vi.advanceTimersByTime(60_000);
    expect(sources).toHaveLength(1);
  });
});
