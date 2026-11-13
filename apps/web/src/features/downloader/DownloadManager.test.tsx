import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DownloadManager } from './DownloadManager.js';
import type { QueuedDownload } from './DownloadManager.js';

vi.mock('@/lib/api.js', async (orig) => {
  const actual = await orig<typeof import('@/lib/api.js')>();
  return {
    ...actual,
    openDownloadEvents: vi.fn(),
    cancelDownload: vi.fn(),
    cancelDownloadItem: vi.fn(),
  };
});

import { openDownloadEvents } from '@/lib/api.js';

// A minimal stand-in for the real EventSource (not available in jsdom) —
// just enough surface for DownloadManager to attach handlers to and for
// this test to drive them directly.
class FakeEventSource {
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

function makeJob(jobId: string, gameId: string, romName: string): QueuedDownload {
  return { jobId, items: [{ gameId, romName }], target: 'server', destinationDir: '/roms' };
}

function renderManager(props: Parameters<typeof DownloadManager>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DownloadManager {...props} />
    </QueryClientProvider>,
  );
}

describe('DownloadManager — clear completed', () => {
  let sources: Map<string, FakeEventSource>;

  beforeEach(() => {
    sources = new Map();
    vi.mocked(openDownloadEvents).mockImplementation((jobId: string) => {
      const es = new FakeEventSource();
      sources.set(jobId, es);
      return es as unknown as EventSource;
    });
  });

  function emit(jobId: string, event: unknown): void {
    act(() => {
      sources.get(jobId)!.onmessage!({ data: JSON.stringify(event) });
    });
  }

  it('only enables the button once a job finishes, and clears only that job', async () => {
    const jobA = makeJob('job-a', 'g1', 'Game A.sfc');
    const jobB = makeJob('job-b', 'g2', 'Game B.sfc');
    const onClearCompleted = vi.fn();

    renderManager({ jobs: [jobA, jobB], onClearCompleted });

    const button = screen.getByRole('button', { name: /vider/i });
    expect(button).toBeDisabled();

    // job-a finishes, job-b is still running.
    emit('job-a', { type: 'complete' });
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    expect(onClearCompleted).toHaveBeenCalledWith(['job-a']);
    // job-b's own EventSource must never be touched by clearing job-a.
    expect(sources.get('job-b')!.close).not.toHaveBeenCalled();
  });

  it('stays disabled while every job is still running', () => {
    const jobA = makeJob('job-a', 'g1', 'Game A.sfc');
    renderManager({ jobs: [jobA], onClearCompleted: vi.fn() });

    expect(screen.getByRole('button', { name: /vider/i })).toBeDisabled();
  });

  it("treats a lost connection ('error') as finished, not running", () => {
    const jobA = makeJob('job-a', 'g1', 'Game A.sfc');
    renderManager({ jobs: [jobA], onClearCompleted: vi.fn() });

    act(() => {
      sources.get('job-a')!.onerror!();
    });

    expect(screen.getByRole('button', { name: /vider/i })).not.toBeDisabled();
  });
});
