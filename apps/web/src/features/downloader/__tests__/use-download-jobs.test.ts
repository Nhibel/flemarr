import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as api from '@/lib/api.js';
import type * as ApiModule from '@/lib/api.js';
import { triggerBrowserSave } from '@/lib/browser-save.js';
import { useDownloadJobs } from '../use-download-jobs.js';
import type { QueuedDownload } from '../job-state.js';

vi.mock('@/lib/api.js', async (orig) => {
  const actual = await orig<typeof ApiModule>();
  return { ...actual, openDownloadEvents: vi.fn() };
});
vi.mock('@/lib/browser-save.js', () => ({ triggerBrowserSave: vi.fn() }));

class FakeEventSource {
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

function browserJob(over: Partial<QueuedDownload> = {}): QueuedDownload {
  return {
    jobId: 'j1',
    datId: 'dat-1',
    target: 'browser',
    items: ['a.bin', 'b.bin'].map((romName) => ({
      gameId: 'g1',
      romName,
      expectedCrc: 'aabbccdd',
      sources: [{ url: 'https://example.invalid/x', extractFromZip: false }],
    })),
    ...over,
  };
}

function fileReady(romName: string) {
  return { type: 'file-ready', gameId: 'g1', romName, downloadUrl: `/api/x/${romName}` };
}

let stream: FakeEventSource;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.openDownloadEvents).mockImplementation(() => {
    stream = new FakeEventSource();
    return stream as unknown as EventSource;
  });
});

function emit(event: unknown) {
  act(() => stream.onmessage!({ data: JSON.stringify(event) }));
}

describe('useDownloadJobs — browser saves', () => {
  it('saves each file as it becomes ready', () => {
    renderHook(() => useDownloadJobs({ jobs: [browserJob()] }));
    emit(fileReady('a.bin'));
    expect(triggerBrowserSave).toHaveBeenCalledWith('/api/x/a.bin', 'a.bin');
  });

  // A job picked up after a reload replays its past events; the server
  // serves each file once, so a past save must not run again.
  it('does not save again the files an earlier page already saved', () => {
    renderHook(() => useDownloadJobs({ jobs: [browserJob({ handledEvents: 1 })] }));
    emit(fileReady('a.bin'));
    expect(triggerBrowserSave).not.toHaveBeenCalled();
    emit(fileReady('b.bin'));
    expect(triggerBrowserSave).toHaveBeenCalledOnce();
    expect(triggerBrowserSave).toHaveBeenCalledWith('/api/x/b.bin', 'b.bin');
  });

  it('still folds replayed events into the job state', () => {
    const { result } = renderHook(() =>
      useDownloadJobs({ jobs: [browserJob({ handledEvents: 1 })] }),
    );
    emit({ type: 'complete' });
    expect(result.current.jobStates.get('j1')?.status).toBe('done');
  });

  it('does not save a file twice when the stream is cut and replayed', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDownloadJobs({ jobs: [browserJob()] }));
      emit(fileReady('a.bin'));
      act(() => stream.onerror!());
      expect(result.current.jobStates.get('j1')?.status).toBe('running');

      act(() => void vi.advanceTimersByTime(1000));
      emit(fileReady('a.bin'));
      expect(triggerBrowserSave).toHaveBeenCalledOnce();
      emit(fileReady('b.bin'));
      expect(triggerBrowserSave).toHaveBeenCalledTimes(2);
      const statuses = result.current.jobStates.get('j1')?.items.map((item) => item.status);
      expect(statuses).toEqual(['done', 'done']);
    } finally {
      vi.useRealTimers();
    }
  });
});
