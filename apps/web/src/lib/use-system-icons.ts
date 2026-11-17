import { useQuery } from '@tanstack/react-query';
import type { SystemIconStyle } from '@shared/system-icon.js';
import { fetchSystemIcons } from '@/lib/api.js';

/**
 * Which icon set covers each of these systems, in one request for the whole
 * set rather than one per name.
 *
 * The key is the sorted list, so a screen asking for a single system and
 * another asking for the same single system share one query — the header and
 * the folder bar both show the open system, and that is one call, not two.
 *
 * `staleTime: Infinity`: the backend resolves against a pinned upstream
 * commit, so the answer cannot change while the app is open.
 */
export function useSystemIcons(systems: string[]): Map<string, SystemIconStyle | null> {
  const wanted = [...new Set(systems)].sort();
  const { data } = useQuery({
    queryKey: ['system-icons', wanted.join('\u0000')],
    queryFn: () => fetchSystemIcons(wanted),
    enabled: wanted.length > 0,
    staleTime: Infinity,
    // An icon is decoration: a provider outage must not retry in a loop
    // behind every system name on the screen.
    retry: false,
  });

  return new Map((data?.icons ?? []).map((icon) => [icon.system, icon.style]));
}
