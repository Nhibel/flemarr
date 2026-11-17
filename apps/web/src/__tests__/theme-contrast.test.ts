import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The palette rules the design canvas settled on include "body text clears
 * 4.5:1 on its own background, muted metadata included, and a bright accent
 * always carries dark text". That was a promise nothing checked: there is no
 * browser in these sessions, so the only way to hold the seven themes to it
 * is to compute it.
 *
 * This reads panda.config.ts rather than the generated tokens, because the
 * config is where the palettes are authored and where a regression would be
 * introduced. rgba washes are composited over the surface they sit on, which
 * is what the browser does with them.
 */

// Resolved from the Vitest root (apps/web), not from import.meta.url — the
// transformed module's URL is not a file: URL, so readFileSync rejects it.
const CONFIG = readFileSync(resolve(process.cwd(), 'panda.config.ts'), 'utf8');

const THEMES = [
  'base',
  '_dark',
  '_catppuccin',
  '_cyberpunk',
  '_matrix',
  '_sonicmania',
  '_contraste',
] as const;
type Theme = (typeof THEMES)[number];

/** Flattens `semanticTokens.colors` to `{ 'fg.default': { base: '#…' } }`. */
function readTokens(src: string): Record<string, Partial<Record<Theme, string>>> {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === 'colors: {');
  const out: Record<string, Partial<Record<Theme, string>>> = {};
  const path: string[] = [];
  let cur: Partial<Record<Theme, string>> | null = null;

  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i]?.trim() ?? '';
    if (t.startsWith('//')) continue;
    if (t === 'value: {') {
      cur = {};
      continue;
    }
    if (cur) {
      const m = t.match(/^(base|_[a-z]+):\s*'([^']+)'/);
      if (m?.[1] && m[2]) {
        cur[m[1] as Theme] = m[2];
        continue;
      }
      if (t === '},') {
        out[path.join('.')] = cur;
        cur = null;
        continue;
      }
    }
    const open = t.match(/^([a-zA-Z0-9]+):\s*\{$/);
    if (open?.[1]) {
      path.push(open[1]);
      continue;
    }
    if (t === '},' || t === '}') {
      if (path.length === 0) break;
      path.pop();
    }
  }
  return out;
}

type Rgba = [number, number, number, number];

function parseColor(c: string | undefined): Rgba | null {
  if (c === undefined) return null;
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = c.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
  if (rgba) return [+rgba[1]!, +rgba[2]!, +rgba[3]!, +rgba[4]!];
  return null;
}

/** Source-over compositing, so a wash is measured as it actually renders. */
function flatten(fg: Rgba, bg: Rgba): Rgba {
  return [
    fg[0] * fg[3] + bg[0] * (1 - fg[3]),
    fg[1] * fg[3] + bg[1] * (1 - fg[3]),
    fg[2] * fg[3] + bg[2] * (1 - fg[3]),
    1,
  ];
}

function luminance([r, g, b]: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

interface Pair {
  label: string;
  fg: string;
  bg: string;
  /** What `bg` itself sits on, needed when `bg` is a translucent wash. */
  backdrop?: string;
  min: number;
}

const PAIRS: Pair[] = [
  { label: 'fg.default on bg.page', fg: 'fg.default', bg: 'bg.page', min: 4.5 },
  { label: 'fg.default on bg.surface', fg: 'fg.default', bg: 'bg.surface', min: 4.5 },
  { label: 'fg.muted on bg.surface', fg: 'fg.muted', bg: 'bg.surface', min: 4.5 },
  { label: 'fg.subtle on bg.surface', fg: 'fg.subtle', bg: 'bg.surface', min: 4.5 },
  { label: 'fg.subtle on bg.inset', fg: 'fg.subtle', bg: 'bg.inset', min: 4.5 },
  // fg.faint is decorative (placeholder initials, timestamps), so it is
  // held to the 3:1 that applies to non-text and large text, not to 4.5.
  { label: 'fg.faint on bg.surface', fg: 'fg.faint', bg: 'bg.surface', min: 3 },
  // The mono pair. fg.data stands in for fg.subtle at a technical value,
  // so it answers to 4.5; fg.dataFaint stands in for fg.faint and keeps
  // that role's 3:1.
  { label: 'fg.data on bg.surface', fg: 'fg.data', bg: 'bg.surface', min: 4.5 },
  { label: 'fg.data on bg.page', fg: 'fg.data', bg: 'bg.page', min: 4.5 },
  { label: 'fg.dataFaint on bg.surface', fg: 'fg.dataFaint', bg: 'bg.surface', min: 3 },
  // The action dock. Six themes make bg.inverse the same value as
  // bg.surface; Sonic Mania does not, which is exactly why its text needs
  // measuring separately rather than being assumed to match fg.default.
  { label: 'fg.onInverse on bg.inverse', fg: 'fg.onInverse', bg: 'bg.inverse', min: 4.5 },
  {
    label: 'fg.onInverseMuted on bg.inverse',
    fg: 'fg.onInverseMuted',
    bg: 'bg.inverse',
    min: 4.5,
  },
  { label: 'accent.fg on accent.solid', fg: 'accent.fg', bg: 'accent.solid', min: 4.5 },
  { label: 'accent2.fg on accent2.solid', fg: 'accent2.fg', bg: 'accent2.solid', min: 4.5 },
  {
    label: 'warning.fg on warning.solid',
    fg: 'status.warning.fg',
    bg: 'status.warning.solid',
    min: 4.5,
  },
  {
    label: 'accent.text on accent.subtle',
    fg: 'accent.text',
    bg: 'accent.subtle',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  {
    label: 'success.text on its wash',
    fg: 'status.success.text',
    bg: 'status.success.subtle',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  {
    label: 'danger.text on its wash',
    fg: 'status.danger.text',
    bg: 'status.danger.subtle',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  {
    label: 'warning.text on its wash',
    fg: 'status.warning.text',
    bg: 'status.warning.subtle',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  {
    label: 'info.text on its wash',
    fg: 'status.info.text',
    bg: 'status.info.subtle',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  // The status TAGS, which are a wash in six themes and a solid fill in
  // Cyberpunk. Measured separately from status.*.text precisely because
  // the two shapes diverge: a tag that passed as a wash says nothing
  // about the same role drawn as an opaque fill with dark text.
  {
    label: 'chip.success.fg on chip.success.bg',
    fg: 'chip.success.fg',
    bg: 'chip.success.bg',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  {
    label: 'chip.warning.fg on chip.warning.bg',
    fg: 'chip.warning.fg',
    bg: 'chip.warning.bg',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  {
    label: 'chip.info.fg on chip.info.bg',
    fg: 'chip.info.fg',
    bg: 'chip.info.bg',
    backdrop: 'bg.surface',
    min: 4.5,
  },
  // Cyberpunk's Catégorie filter trigger, tinted by family.
  {
    label: 'accent2.text on accent2.subtle',
    fg: 'accent2.text',
    bg: 'accent2.subtle',
    backdrop: 'bg.surface',
    min: 4.5,
  },
];

/**
 * Pairs that fall short and are kept anyway, with the reason.
 *
 * Empty, and meant to stay that way. It held one entry — Sonic Mania's
 * white on the #E8215C its artboard specified, measuring 4.37:1 — until
 * Camille chose the rule over the comp and the magenta was darkened to
 * #E01B55. Every pair now clears its threshold in all seven themes.
 */
const ACCEPTED: Record<string, string[]> = {};

const tokens = readTokens(CONFIG);

describe('theme contrast', () => {
  it('parsed every theme out of the config', () => {
    // Guards the parser itself: if the config's shape changes and this
    // reads nothing, every assertion below would vacuously pass.
    expect(Object.keys(tokens).length).toBeGreaterThan(30);
    for (const theme of THEMES) {
      expect(tokens['bg.page']?.[theme], `bg.page missing for ${theme}`).toBeDefined();
    }
  });

  it.each(THEMES)('%s meets the palette rules', (theme) => {
    const failures: string[] = [];

    for (const pair of PAIRS) {
      if (ACCEPTED[theme]?.includes(pair.label)) continue;

      const fgRaw = parseColor(tokens[pair.fg]?.[theme]);
      let bgRaw = parseColor(tokens[pair.bg]?.[theme]);
      expect(fgRaw, `${pair.fg} unreadable for ${theme}`).not.toBeNull();
      expect(bgRaw, `${pair.bg} unreadable for ${theme}`).not.toBeNull();
      if (!fgRaw || !bgRaw) continue;

      if (bgRaw[3] < 1) {
        const backdrop = parseColor(tokens[pair.backdrop ?? '']?.[theme]);
        expect(backdrop, `${pair.label} needs a backdrop for ${theme}`).not.toBeNull();
        if (!backdrop) continue;
        bgRaw = flatten(bgRaw, backdrop);
      }
      const fg = fgRaw[3] < 1 ? flatten(fgRaw, bgRaw) : fgRaw;

      const r = contrast(fg, bgRaw);
      if (r < pair.min) failures.push(`${pair.label}: ${r.toFixed(2)} (needs ${pair.min})`);
    }

    expect(failures).toEqual([]);
  });
});
