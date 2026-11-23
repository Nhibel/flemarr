import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDatFromFresh1g1r, fetchDatUpdates } from '@/lib/api.js';
import type { DatUpdate } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { invalidateLoadedDat } from '@/lib/invalidate-loaded-dat.js';

// The server keeps its own answer for hours (releases are daily); asking
// it more often than hourly only re-reads that answer.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Systems loaded from Fresh1G1R whose set has a newer version, and the
 * action that loads it. A failed check shows nothing: an update notice is
 * a convenience, not something to report an error about.
 */
export function useDatUpdates() {
  const queryClient = useQueryClient();
  const { data: updates = [] } = useQuery({
    queryKey: queryKeys.datUpdates(),
    queryFn: fetchDatUpdates,
    staleTime: CHECK_INTERVAL_MS,
    gcTime: CHECK_INTERVAL_MS,
    retry: false,
  });

  const apply = useMutation({
    mutationFn: ({ preset, path, revision }: DatUpdate) =>
      fetchDatFromFresh1g1r({ preset, path, revision }),
    onSuccess: (_dat, { datId }) => invalidateLoadedDat(queryClient, datId),
  });

  const updatesByDat = new Map(updates.map((update) => [update.datId, update]));
  const updatingDatId = apply.isPending ? apply.variables.datId : null;

  return { updatesByDat, applyUpdate: apply.mutate, updatingDatId };
}
