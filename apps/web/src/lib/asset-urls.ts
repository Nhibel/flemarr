/**
 * URLs of images the server proxies. Pure string builders, kept out of
 * api.ts so a shared component can show an image without depending on the
 * API layer. The browser never talks to the image providers directly.
 */

/** Boxart of one game of a loaded DAT. */
export function gameBoxartUrl(datId: string, gameId: string): string {
  return `/api/dats/${encodeURIComponent(datId)}/games/${encodeURIComponent(gameId)}/boxart`;
}

/** Icon of a system, by its DAT system name. */
export function systemIconUrl(system: string): string {
  return `/api/systems/icon?system=${encodeURIComponent(system)}`;
}
