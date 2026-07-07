import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/lib/api.js';

/**
 * The library root (ROMS_ROOT) paths are displayed relative to — null when
 * unset (local dev, absolute paths shown as-is) or while settings load.
 */
export function useRomsRoot(): string | null {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  return data?.romsRoot ?? null;
}
