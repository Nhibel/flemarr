import { useState } from 'react';

export type Theme =
  | 'light'
  | 'dark'
  | 'catppuccin'
  | 'cyberpunk'
  | 'matrix'
  | 'nintendo'
  | 'megadrive'
  | 'sonicmania';

const THEMES: Theme[] = [
  'light',
  'dark',
  'catppuccin',
  'cyberpunk',
  'matrix',
  'nintendo',
  'megadrive',
  'sonicmania',
];

const STORAGE_KEY = 'rom-curator-theme';

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
