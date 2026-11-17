import type { SystemIcon } from '@shared/system-icon.js';
import { getIconIndex, resolveIcon, iconUrl } from './retroarch-assets.js';

/**
 * Which icon set covers each of these systems, or null when none does.
 * Resolution is a lookup in an index cached on disk, so this is local work
 * after the first call of an installation's lifetime.
 */
export async function getSystemIcons(systems: string[]): Promise<SystemIcon[]> {
  const index = await getIconIndex();
  return systems.map((system) => ({
    system,
    style: resolveIcon(system, index)?.style ?? null,
  }));
}

/**
 * Upstream PNG URL for a system, for the image proxy route. The URL is built
 * here from the index — the route never fetches an address a caller supplied.
 */
export async function systemIconUrl(system: string): Promise<string | null> {
  const index = await getIconIndex();
  const icon = resolveIcon(system, index);
  return icon === null ? null : iconUrl(icon);
}
