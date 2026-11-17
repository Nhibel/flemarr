/**
 * libretro-thumbnails boxart provider. No API and no quota: thumbnails are
 * plain files at
 *   https://thumbnails.libretro.com/<System>/Named_Boxarts/<Game>.png
 * where <System> follows the No-Intro/Redump "Vendor - System" naming and
 * <Game> is the canonical game name with forbidden characters replaced.
 */

import { stripDatSystemTags } from '@/lib/dat-system.js';

const BASE_URL = 'https://thumbnails.libretro.com';

// DAT header names and libretro-thumbnails directory names diverge for a few
// systems. Verified live against thumbnails.libretro.com (2026-07-11); extend
// as more divergent systems show 100% misses.
const DIR_ALIASES: Record<string, string> = {
  'Sega - Mega CD & Sega CD': 'Sega - Mega-CD - Sega CD',
  'NEC - PC Engine CD & TurboGrafx CD': 'NEC - PC Engine CD - TurboGrafx-CD',
};

/**
 * DAT system name → libretro system directory: drop the trailing
 * parenthesized tags Retool appends ("(Retool)", dates…) but keep the
 * "Vendor - System" form, which is what libretro-thumbnails uses.
 */
export function libretroSystemDir(datSystem: string): string {
  const name = stripDatSystemTags(datSystem);
  return DIR_ALIASES[name] ?? name;
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
