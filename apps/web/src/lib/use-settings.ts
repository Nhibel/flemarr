import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';

/**
 * The server settings, shared by every screen that reads them. One
 * definition so the key and the fetcher can never disagree between callers.
 * Writers resync it with `setQueryData(queryKeys.settings(), updated)`.
 */
export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings(), queryFn: getSettings });
}
