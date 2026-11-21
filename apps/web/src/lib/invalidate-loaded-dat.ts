import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys.js';

/**
 * Resyncs the cache after a DAT was (re)loaded. Reloading a system keeps
 * its DAT id (the server replaces the DAT of the same system and source in
 * place), so the games and boxart pages cached under that id are stale too,
 * not just the systems list.
 */
export function invalidateLoadedDat(queryClient: QueryClient, datId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.dats() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.datUpdates() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.games(datId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.gameDetails(datId) });
}
