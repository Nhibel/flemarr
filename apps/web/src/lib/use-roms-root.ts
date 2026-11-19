import { useSettings } from '@/lib/use-settings.js';

/**
 * The library root (ROMS_ROOT) paths are displayed relative to — null when
 * unset (local dev, absolute paths shown as-is) or while settings load.
 */
export function useRomsRoot(): string | null {
  const { data } = useSettings();
  return data?.romsRoot ?? null;
}
