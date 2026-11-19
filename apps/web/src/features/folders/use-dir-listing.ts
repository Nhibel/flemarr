import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createDir, listDirs } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { joinPath } from './folder-paths.js';

/** Typing pauses this long before the folder under the cursor is listed. */
const LIST_DEBOUNCE_MS = 250;

/**
 * The server-side half of the folder picker: lists the folder being typed
 * (debounced, and only while the picker is open) and creates subfolders in it.
 */
export function useDirListing(value: string, open: boolean) {
  const queryClient = useQueryClient();
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), LIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const { data: listing } = useQuery({
    queryKey: queryKeys.listDirs(debouncedValue),
    queryFn: () => listDirs(debouncedValue),
    enabled: open,
    staleTime: 30_000,
  });

  const listedPath = listing?.listedPath ?? '';

  /**
   * Creates `name` under the folder currently listed. Resolves to the new
   * folder's path, or null when nothing was created (empty name, nothing
   * listed, or a server error — the error is in `createError`).
   */
  const createFolder = useCallback(
    async (name: string): Promise<string | null> => {
      const trimmedName = name.trim();
      if (!trimmedName || !listedPath) return null;
      setCreating(true);
      setCreateError(null);
      try {
        const { path } = await createDir(joinPath(listedPath, trimmedName));
        // Every listing may now be out of date, not just this folder's.
        await queryClient.invalidateQueries({ queryKey: queryKeys.listDirs() });
        return path;
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Création impossible');
        return null;
      } finally {
        setCreating(false);
      }
    },
    [listedPath, queryClient],
  );

  return { listing, listedPath, creating, createError, createFolder };
}
