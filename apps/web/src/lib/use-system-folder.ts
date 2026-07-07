import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/lib/api.js';

/**
 * The folder configured for a system (settings.systemPaths[system]).
 * Single source of truth for the scanner and the downloader destination —
 * written only by SystemFolderBar. `folder` is '' while loading or unset.
 */
export function useSystemFolder(system: string): { folder: string; loaded: boolean } {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  return { folder: data?.systemPaths[system] ?? '', loaded: data !== undefined };
}
