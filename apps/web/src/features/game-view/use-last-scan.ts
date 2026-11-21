import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLastScan } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useSystemFolder } from '@/lib/use-system-folder.js';
import type { ScanResult } from '@shared/scan.js';

/**
 * The DAT's last scan, kept server-side so ownership survives a reload.
 * Only counts while it was a scan of the system's current folder: after a
 * folder change it describes a folder the app no longer looks at.
 */
export function useLastScan(datId: string, system: string) {
  const queryClient = useQueryClient();
  const { folder } = useSystemFolder(system);
  const { data: stored = null } = useQuery({
    queryKey: queryKeys.lastScan(datId),
    queryFn: () => fetchLastScan(datId),
  });

  const isOfCurrentFolder = stored !== null && stored.directory === folder;
  const lastScan: ScanResult | null = isOfCurrentFolder ? stored.result : null;
  const lastScanAt = isOfCurrentFolder ? new Date(stored.scannedAt) : null;

  // The server stores a scan before announcing it done: refetch on done.
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: queryKeys.lastScan(datId) }),
    [datId, queryClient],
  );

  return { lastScan, lastScanAt, refresh };
}
