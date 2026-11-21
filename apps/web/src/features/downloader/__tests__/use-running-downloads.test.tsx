import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import { useRunningDownloads } from '../use-running-downloads.js';

vi.mock('@/lib/api.js');

function renderRunning(onRunning = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  renderHook(() => useRunningDownloads('dat-1', onRunning), { wrapper });
  return onRunning;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRunningDownloads', () => {
  it('hands over the running jobs, with the events already handled', async () => {
    vi.mocked(api.fetchRunningDownloads).mockResolvedValue([
      {
        jobId: 'j1',
        datId: 'dat-1',
        target: 'server',
        destinationDir: '/roms',
        items: [],
        eventCount: 4,
      },
    ]);
    const onRunning = renderRunning();
    await waitFor(() =>
      expect(onRunning).toHaveBeenCalledWith([
        {
          jobId: 'j1',
          datId: 'dat-1',
          target: 'server',
          destinationDir: '/roms',
          items: [],
          handledEvents: 4,
        },
      ]),
    );
    expect(api.fetchRunningDownloads).toHaveBeenCalledWith('dat-1');
  });

  it('hands over nothing when no job runs', async () => {
    vi.mocked(api.fetchRunningDownloads).mockResolvedValue([]);
    const onRunning = renderRunning();
    await waitFor(() => expect(api.fetchRunningDownloads).toHaveBeenCalled());
    expect(onRunning).not.toHaveBeenCalled();
  });
});
