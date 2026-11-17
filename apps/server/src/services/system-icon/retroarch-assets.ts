/**
 * System icons from libretro/retroarch-assets (CC BY 4.0). Like the boxart
 * provider next door there is no API and no quota: the icons are plain PNG
 * files in a GitHub repository, named after the same No-Intro/Redump
 * "Vendor - System" convention the DAT headers use.
 *
 *   https://raw.githubusercontent.com/libretro/retroarch-assets/<sha>/xmb/<style>/png/<Name>.png
 *
 * Two of the repository's nine icon sets are used, in this order:
 *
 *   systematic — a flat colour drawing of the machine itself, 948 icons.
 *   monochrome — a white silhouette on transparent, 556 icons, used as a CSS
 *                mask by the web app so it takes a theme colour.
 *
 * The commit is PINNED rather than tracking `master`: upstream renames and
 * removes files, and a pinned tree means the name index below is immutable,
 * so it is fetched once and never goes stale.
 */
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { SystemIconStyle } from '@shared/system-icon.js';
import { dataDir } from '@/lib/db.js';
import { stripDatSystemTags } from '@/lib/dat-system.js';

const REPO = 'libretro/retroarch-assets';
/** retroarch-assets @ 2026-11-09. Bump with the index cache name in mind. */
const ASSETS_SHA = '8c918e2872482139273374ef4cc6c7aff34d7585';

/** Probed in this order; the first set that has the system wins. */
export const STYLES: readonly SystemIconStyle[] = ['systematic', 'monochrome'];

/**
 * DAT system names that no rule below can bend into the upstream name,
 * because upstream files the machine under a different company or a
 * different product entirely. Verified against the pinned tree — every
 * target here exists, and the unit test re-checks that against the index.
 */
export const NAME_ALIASES: Record<string, string> = {
  '3DO Interactive Multiplayer': 'The 3DO Company - 3DO',
  'Panasonic - 3DO Interactive Multiplayer': 'The 3DO Company - 3DO',
  'Apple - Pippin': 'Apple-Bandai - Pippin',
  'Bandai - Pippin': 'Apple-Bandai - Pippin',
  'Bandai - Playdia Quick Interactive System': 'Bandai - Playdia',
  'Atari - Jaguar CD Interactive Multimedia System': 'Atari - Jaguar CD',
  // The three Amiga disc machines share the Amiga icon: upstream draws the
  // computer, not the CD add-ons.
  'Commodore - Amiga CD': 'Commodore - Amiga',
  'Commodore - Amiga CD32': 'Commodore - Amiga',
  'Commodore - Amiga CDTV': 'Commodore - Amiga',
  'ZAPiT Games - Game Wave Family Entertainment System': 'ZAPiT - Game Wave',
  'Handheld - Cybiko': 'Cybiko - Cybiko Classic',
  'Handheld - Palm OS': 'Mobile - Palm OS',
  Palm: 'Mobile - Palm OS',
  'Handheld - Microsoft - Pocket PC': 'Mobile - Pocket PC',
  'Pocket PC': 'Mobile - Pocket PC',
  'Arcade - Sega - Naomi': 'Sega - Naomi',
  'Arcade - Sega - Naomi 2': 'Sega - Naomi 2',
  'Arcade - Sega - Chihiro': 'Sega - Chihiro',
  'Arcade - Namco - Sega - Nintendo - Triforce': 'Namco, Sega, Nintendo - TriForce (Cartridges)',
  'IBM - PC compatible': 'IBM - PC and Compatibles',
  'Arcade - PC-based': 'IBM - PC and Compatibles',
  'Arcade - PC-based Arcade': 'IBM - PC and Compatibles',
};

/**
 * Matching key: case, spaces and punctuation dropped. Upstream and the DAT
 * headers disagree constantly on those alone — "NeoGeo" against "Neo Geo",
 * "TurboGrafx-16" against "TurboGrafx 16" — and nothing else distinguishes
 * two real systems, so collapsing them is safe and buys ~25 matches.
 */
export function iconMatchKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Names to try for one DAT system, best first. Each rule exists because a
 * real DAT needed it:
 *
 *   "Atari - Atari 2600"        the vendor repeated inside the system name
 *   "Sega - Mega CD & Sega CD"  two regional names joined by &
 *   "NEC - PC-98 series"        a trailing "series"
 *   "Sega - SG-1000 - SC-3000"  a third segment upstream does not carry
 *   "Arcade - Sega - Naomi"     the vendorless tail ("Sega - Naomi")
 */
export function iconNameCandidates(datSystem: string): string[] {
  const system = stripDatSystemTags(datSystem);
  const out: string[] = [];
  const aliased = NAME_ALIASES[system];
  if (aliased !== undefined) out.push(aliased);
  out.push(system);

  const parts = /^([^-]+) - (.+)$/.exec(system);
  if (parts !== null) {
    const vendor = parts[1] ?? '';
    const rest = parts[2] ?? '';
    if (rest.toLowerCase().startsWith(`${vendor.toLowerCase()} `)) {
      out.push(`${vendor} - ${rest.slice(vendor.length + 1)}`);
    }
    const joined = /^(.+?) (?:&|and) (.+)$/.exec(rest);
    if (joined !== null) out.push(`${vendor} - ${joined[1] ?? ''}`);
    if (/ series$/i.test(rest)) out.push(`${vendor} - ${rest.replace(/ series$/i, '')}`);
    const third = /^(.+?) - (.+)$/.exec(rest);
    if (third !== null) out.push(`${vendor} - ${third[1] ?? ''}`);
    out.push(rest);
  }
  return out;
}

/** style → (match key → the exact upstream filename, without .png). */
export type IconIndex = Map<SystemIconStyle, Map<string, string>>;

export interface ResolvedIcon {
  style: SystemIconStyle;
  /** Exact upstream filename stem, needed to build the download URL. */
  name: string;
}

/**
 * The colour set first, then the silhouette: a system drawn in colour is
 * preferred, and the silhouette only covers what the colour set lacks.
 */
export function resolveIcon(datSystem: string, index: IconIndex): ResolvedIcon | null {
  const candidates = iconNameCandidates(datSystem);
  for (const style of STYLES) {
    const names = index.get(style);
    if (names === undefined) continue;
    for (const candidate of candidates) {
      const name = names.get(iconMatchKey(candidate));
      if (name !== undefined) return { style, name };
    }
  }
  return null;
}

export function iconUrl(icon: ResolvedIcon): string {
  const file = encodeURIComponent(`${icon.name}.png`);
  return `https://raw.githubusercontent.com/${REPO}/${ASSETS_SHA}/xmb/${icon.style}/png/${file}`;
}

const treeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});

const indexFileSchema = z.record(z.string(), z.array(z.string()));

/**
 * Upstream paths → the per-style name lists this module indexes. Files whose
 * stem ends in "-content" are skipped: those are the "add content" tiles of
 * the menu, not system icons.
 */
export function pathsToNames(paths: string[]): Record<string, string[]> {
  const byStyle: Record<string, string[]> = {};
  for (const style of STYLES) byStyle[style] = [];
  for (const path of paths) {
    const m = /^xmb\/([a-z-]+)\/png\/(.+)\.png$/.exec(path);
    if (m === null) continue;
    const style = m[1] ?? '';
    const stem = m[2] ?? '';
    if (stem.endsWith('-content') || !(style in byStyle)) continue;
    byStyle[style]?.push(stem);
  }
  return byStyle;
}

export function buildIndex(byStyle: Record<string, string[]>): IconIndex {
  const index: IconIndex = new Map();
  for (const style of STYLES) {
    const names = new Map<string, string>();
    for (const stem of byStyle[style] ?? []) {
      // Also filtered in pathsToNames, and again here: the index can also
      // come from a cache file written by an older build.
      if (stem.endsWith('-content')) continue;
      const key = iconMatchKey(stem);
      // First name wins: the listing is in upstream order, so a plain
      // "Sega - Naomi" is kept over a later "Sega - Naomi (alt)".
      if (!names.has(key)) names.set(key, stem);
    }
    index.set(style, names);
  }
  return index;
}

function indexCachePath(): string {
  return join(dataDir(), 'cache', `retroarch-assets-${ASSETS_SHA}.json`);
}

async function fetchNames(): Promise<Record<string, string[]>> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${ASSETS_SHA}?recursive=1`,
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'rom-curator/1.0' } },
  );
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} listing retroarch-assets`);
  const parsed = treeSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error('Unexpected GitHub API response shape');
  return pathsToNames(parsed.data.tree.filter((e) => e.type === 'blob').map((e) => e.path));
}

let cached: IconIndex | null = null;
let inFlight: Promise<IconIndex> | null = null;

/**
 * The name index, from memory, then from disk, then from GitHub. The commit
 * is pinned, so the on-disk copy is valid forever and the repository is
 * listed at most once per installation.
 *
 * Concurrent callers share one fetch: the sidebar asks for every loaded
 * system at once, and without this the first page load would list the
 * repository several times over.
 */
export async function getIconIndex(): Promise<IconIndex> {
  if (cached !== null) return cached;
  if (inFlight !== null) return inFlight;

  inFlight = (async () => {
    const path = indexCachePath();
    try {
      const parsed = indexFileSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
      if (parsed.success) {
        cached = buildIndex(parsed.data);
        return cached;
      }
    } catch {
      // No cache yet, or an unreadable one: fall through and fetch.
    }

    const byStyle = await fetchNames();
    await mkdir(join(dataDir(), 'cache'), { recursive: true });
    await writeFile(path, JSON.stringify(byStyle), 'utf8');
    cached = buildIndex(byStyle);
    return cached;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Test seam: drops the memoized index so a test can install its own. */
export function resetIconIndexCache(): void {
  cached = null;
  inFlight = null;
}
