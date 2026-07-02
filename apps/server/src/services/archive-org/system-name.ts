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

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
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

/** Does this ZIP look like it holds the whole set for `system`? */
export function zipMatchesSystem(zipPath: string, system: string): boolean {
  return mentionsSystem(stripExtension(baseName(zipPath)), system);
}
