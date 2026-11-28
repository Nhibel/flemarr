import type { ArchiveFile } from '@shared/archive.js';

/**
 * "Nintendo - Super Nintendo Entertainment System (Retool)"
 * → "Super Nintendo Entertainment System": drop the vendor prefix and any
 * trailing parenthesized tags — "(Retool)" in a query poisons the results.
 */
export function normalizeSystemName(system: string): string {
  let name = system.replace(/^[^-]+-\s*/, '').trim() || system;
  for (;;) {
    const stripped = name.replace(/\s*\([^)]*\)$/, '').trim();
    if (stripped === name || stripped === '') break;
    name = stripped;
  }
  return name || system;
}

// Common shorthand used by uploaders — the DAT's official name rarely matches
// how collections (or their ZIPs) are titled on archive.org.
const SYSTEM_ALIASES: Record<string, string[]> = {
  'Super Nintendo Entertainment System': ['SNES'],
  'Nintendo Entertainment System': ['NES'],
  'Game Boy Advance': ['GBA'],
  'Game Boy Color': ['GBC'],
  'Nintendo 64': ['N64'],
  'Nintendo DS': ['NDS'],
  'Mega Drive - Genesis': ['Genesis', 'Mega Drive'],
  'Mega CD & Sega CD': ['Sega CD'],
  'Master System - Mark III': ['Master System'],
  PlayStation: ['PSX', 'PS1'],
  'PlayStation 2': ['PS2'],
  'PlayStation Portable': ['PSP'],
  Saturn: ['Sega Saturn'],
  Dreamcast: ['Sega Dreamcast'],
};

/** Normalized name first, then its aliases. */
export function systemNameVariants(system: string): string[] {
  const short = normalizeSystemName(system);
  return [short, ...(SYSTEM_ALIASES[short] ?? [])];
}

/** Last path segment: archive.org items often nest files in subdirectories. */
export function baseName(path: string): string {
  return path.split('/').at(-1) ?? path;
}

/**
 * Formats that *re-encode* a dump instead of containing it byte for byte:
 * CHD (MAME), RVZ/GCZ/NKit (GameCube/Wii), WBFS, CISO/CSO, PBP. A DAT
 * describes the original bytes, so such a file can never satisfy its CRC —
 * downloading one always ends in a mismatch the worker treats as final.
 *
 * A container that preserves the bytes (.zip, .7z) is a different matter and
 * stays matchable: per-game-zip collections store "Game.sfc" as "Game.zip",
 * which is why name matching ignores extensions in the first place.
 */
const REENCODED_EXTENSIONS = new Set([
  '.chd',
  '.rvz',
  '.gcz',
  '.wbfs',
  '.ciso',
  '.cso',
  '.pbp',
  '.wux',
]);

/** Is this file a re-encode, whose bytes can never match a DAT entry? */
export function isReencodedDump(name: string): boolean {
  const base = baseName(name).toLowerCase();
  const dot = base.lastIndexOf('.');
  return dot > 0 && REENCODED_EXTENSIONS.has(base.slice(dot));
}

/**
 * Archive formats a per-game collection re-packs a ROM into — "Game.sfc"
 * stored as "Game.zip" or "Game.7z". Unlike a re-encode, these preserve the
 * original bytes exactly, so view_archive's extract (or archive.org's own
 * Pattern B magic URL) hands back the raw ROM, byte for byte. The real bug
 * this covers: Redump's rr-sony-playstation-* items store "Game.7z" the
 * same way others store "Game.zip" — missing .7z here mis-detects the whole
 * collection as `direct` layout (detectLayout only ever counted .zip), which
 * then let `findMatch`'s name fallback match the compressed .7z file itself
 * as if it *were* the raw .bin — downloaded fine (no extraction, so fast),
 * and guaranteed to fail CRC (a .7z's bytes are never the ROM's bytes).
 */
const ARCHIVE_CONTAINER_EXTENSIONS = new Set(['.zip', '.7z', '.rar']);

function isArchiveContainerName(name: string): boolean {
  const base = baseName(name).toLowerCase();
  const dot = base.lastIndexOf('.');
  return dot > 0 && ARCHIVE_CONTAINER_EXTENSIONS.has(base.slice(dot));
}

/** Is this file an archive container (.zip, .7z, .rar) by name or reported format? */
export function isArchiveContainer(file: Pick<ArchiveFile, 'name' | 'format'>): boolean {
  const format = file.format?.toUpperCase();
  return (
    format === 'ZIP' || format === '7Z' || format === 'RAR' || isArchiveContainerName(file.name)
  );
}

/** The container's own extraction format, from its filename — undefined if it isn't one. */
export function containerFormat(name: string): 'zip' | '7z' | 'rar' | undefined {
  const base = baseName(name).toLowerCase();
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return undefined;
  const ext = base.slice(dot);
  if (ext === '.zip') return 'zip';
  if (ext === '.7z') return '7z';
  if (ext === '.rar') return 'rar';
  return undefined;
}

// A No-Intro language list: "(En,Ja,Fr,De)", "(Zh-Hant)", "(En)".
const LANGUAGE_TAG = / \([A-Z][a-z](?:-[A-Za-z]+)?(?:,[A-Z][a-z](?:-[A-Za-z]+)?)*\)/g;

/**
 * The name without its language list. No-Intro adds languages to existing
 * entries as they are checked ("1080 Snowboarding (USA) (En,Ja) (LodgeNet)"
 * became "(En,Ja,Fr,De)"), and uploads keep the name of their day.
 */
export function withoutLanguages(name: string): string {
  return name.replace(LANGUAGE_TAG, '');
}

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** The (lowercased, dot-included) extension of a bare filename, or '' if none. */
export function extensionOf(name: string): string {
  const base = baseName(name);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot).toLowerCase() : '';
}

// Multi-word variants match as substrings; single-word variants must match a
// whole token — otherwise the "NES" alias would match every "SNES" ZIP.
function textMentionsVariant(text: string, variant: string): boolean {
  const hay = text.toLowerCase();
  const needle = variant.toLowerCase();
  if (needle.includes(' ')) return hay.includes(needle);
  return hay.split(/[^a-z0-9]+/).includes(needle);
}

/** Does this text (zip name, item title…) reference the system or an alias? */
export function mentionsSystem(text: string, system: string): boolean {
  return systemNameVariants(system).some((v) => textMentionsVariant(text, v));
}

/** Collapse case and whitespace runs so two spellings compare equal. */
function canonical(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export type SystemMatch = 'exact' | 'loose';

/**
 * How strongly a text (a ZIP name, an item title…) identifies `system`.
 *
 * 'exact': the text's own system segment *is* this system. Collections name
 * their per-system ZIPs after the No-Intro/Redump set
 * ("Nintendo - Game Boy (20240101).zip"), so running the text through
 * normalizeSystemName yields a bare system name to compare against.
 *
 * 'loose': the name merely appears somewhere in the text. That is needed for
 * discovery (an item titled "No-Intro Game Boy fullset"), but it also matches
 * a *longer* system: "Game Boy" is a substring of "Game Boy Advance", and
 * "Nintendo Entertainment System" of its "Super" sibling. Since the longer
 * system is usually the bigger download, a loose match must never outrank an
 * exact one — picking by size alone lands on the wrong set and scores zero.
 */
export function systemMatchKind(text: string, system: string): SystemMatch | null {
  const variants = systemNameVariants(system).map(canonical);
  if (variants.includes(canonical(normalizeSystemName(text)))) return 'exact';
  return mentionsSystem(text, system) ? 'loose' : null;
}

/** As systemMatchKind, for a ZIP path inside an archive.org item. */
export function zipSystemMatch(zipPath: string, system: string): SystemMatch | null {
  return systemMatchKind(stripExtension(baseName(zipPath)), system);
}

/** Does this ZIP look like it holds the whole set for `system`? */
export function zipMatchesSystem(zipPath: string, system: string): boolean {
  return zipSystemMatch(zipPath, system) !== null;
}
