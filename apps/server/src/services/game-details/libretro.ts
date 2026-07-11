/**
 * libretro-thumbnails boxart provider. No API and no quota: thumbnails are
 * plain files at
 *   https://thumbnails.libretro.com/<System>/Named_Boxarts/<Game>.png
 * where <System> follows the No-Intro/Redump "Vendor - System" naming and
 * <Game> is the canonical game name with forbidden characters replaced.
 */

const BASE_URL = 'https://thumbnails.libretro.com';

/**
 * DAT system name → libretro system directory: drop the trailing
 * parenthesized tags Retool appends ("(Retool)", dates…) but keep the
 * "Vendor - System" form, which is what libretro-thumbnails uses.
 */
export function libretroSystemDir(datSystem: string): string {
  let name = datSystem.trim();
  for (;;) {
    const stripped = name.replace(/\s*\([^)]*\)$/, '').trim();
    if (stripped === name || stripped === '') break;
    name = stripped;
  }
  return name || datSystem;
}

/**
 * Game name → thumbnail filename, per the libretro-thumbnails convention:
 * the characters &*\/:`<>?\| and " are replaced with '_'.
 */
export function libretroThumbName(gameName: string): string {
  return `${gameName.replace(/[&*/:`<>?\\|"]/g, '_')}.png`;
}

export function boxartUrl(datSystem: string, gameName: string): string {
  const system = encodeURIComponent(libretroSystemDir(datSystem));
  const file = encodeURIComponent(libretroThumbName(gameName));
  return `${BASE_URL}/${system}/Named_Boxarts/${file}`;
}

/** Does the thumbnail exist upstream? HEAD probe, no body transferred. */
export async function probeBoxart(url: string): Promise<boolean> {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  return res.ok;
}
