import { useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys.js';

export type Theme =
  | 'light'
  | 'dark'
  | 'catppuccin'
  | 'nightdrive'
  | 'lemongrid'
  | 'keppel'
  | 'matrix'
  | 'sonicmania'
  | 'contraste';

// Must stay in sync with the `conditions.extend` keys in
// apps/web/panda.config.ts (minus `light`, which is the `base` value there)
// and with the label/description maps in the Apparence settings section.
// `nintendo` and `megadrive` were removed on 2026-11-15, `cyberpunk` on
// 2026-11-18; anyone who had one of them selected is handled by
// getInitialTheme()'s fallback below, which is why no migration is needed
// when a theme leaves.
const THEMES: Theme[] = [
  'light',
  'dark',
  'catppuccin',
  'nightdrive',
  'lemongrid',
  'keppel',
  'matrix',
  'sonicmania',
  'contraste',
];

const STORAGE_KEY = STORAGE_KEYS.theme;

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null && THEMES.includes(stored as Theme)) return stored as Theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// All themes are self-contained looks, selected via one data-theme
// attribute (see panda.config.ts conditions) — not a theme × light/dark
// matrix, so there's no separate "mode" to track alongside this.
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = getInitialTheme();
    applyTheme(t);
    return t;
  });

  const setTheme = (next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  };

  return { theme, setTheme };
}
