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

// The same thumbnails, one GitHub repository per system directory (spaces
// become '_'). thumbnails.libretro.com went empty on 2026-11-21 while these
// kept serving, so every lookup falls back to them.
const MIRROR_BASE_URL = 'https://raw.githubusercontent.com/libretro-thumbnails';

/** The GitHub copy of a thumbnails.libretro.com URL; null for any other URL. */
export function mirrorOf(url: string): string | null {
  const prefix = `${BASE_URL}/`;
  if (!url.startsWith(prefix)) return null;
  const [encodedSystem = '', ...path] = url.slice(prefix.length).split('/');
  const repository = decodeURIComponent(encodedSystem).replace(/ /g, '_');
  return `${MIRROR_BASE_URL}/${encodeURIComponent(repository)}/master/${path.join('/')}`;
}

/** Does the thumbnail exist upstream? HEAD probe, no body transferred. */
export async function probeBoxart(url: string): Promise<boolean> {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  return res.ok;
}

/**
 * Where the thumbnail is found: the provider, else its mirror. Null when
 * neither has it. Throws only when a probe failed on the network and no
 * probe found it, so an outage is never cached as "no boxart".
 */
export async function findBoxart(url: string): Promise<string | null> {
  const mirror = mirrorOf(url);
  const candidates = mirror === null ? [url] : [url, mirror];
  let networkError: unknown = null;
  for (const candidate of candidates) {
    try {
      if (await probeBoxart(candidate)) return candidate;
    } catch (err) {
      networkError = err;
    }
  }
  if (networkError !== null) throw networkError;
  return null;
}

/** The thumbnail's bytes, from its mirror when the provider fails. */
export async function fetchBoxart(url: string): Promise<Response> {
  const mirror = mirrorOf(url);
  if (mirror === null) return fetch(url);
  try {
    const response = await fetch(url);
    if (response.ok) return response;
  } catch {
    // The provider is down: the mirror answers instead.
  }
  return fetch(mirror);
}
