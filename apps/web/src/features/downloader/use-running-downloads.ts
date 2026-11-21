import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRunningDownloads } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import type { QueuedDownload } from './job-state.js';

/**
 * Hands over the DAT's jobs still running on the server when the system's
 * screen mounts: after a reload, they show again and keep progressing
 * instead of running out of sight. Finished jobs are not listed, so a
 * cleared job never comes back.
 */
export function useRunningDownloads(
  datId: string,
  onRunning: (jobs: QueuedDownload[]) => void,
): void {
  const { data } = useQuery({
    queryKey: queryKeys.runningDownloads(datId),
    queryFn: () => fetchRunningDownloads(datId),
    // Read once per mount: a cached list could hold a job finished since.
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (data === undefined || data.length === 0) return;
    onRunning(data.map(({ eventCount, ...job }) => ({ ...job, handledEvents: eventCount })));
  }, [data, onRunning]);
}
