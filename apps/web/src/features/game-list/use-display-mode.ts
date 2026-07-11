import { useState } from 'react';

export type DisplayMode = 'compact' | 'normal' | 'detailed';

export const DISPLAY_MODES: DisplayMode[] = ['compact', 'normal', 'detailed'];

const STORAGE_KEY = 'rom-curator.display-mode';

function load(): DisplayMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'compact' || raw === 'normal' || raw === 'detailed' ? raw : 'normal';
  } catch {
    return 'normal';
  }
}

/** Persistent UI preference — localStorage, not server settings (ARCHITECTURE.md). */
export function useDisplayMode(): [DisplayMode, (m: DisplayMode) => void] {
  const [mode, setMode] = useState<DisplayMode>(load);

  function update(next: DisplayMode) {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — the choice just won't survive a reload
    }
  }

  return [mode, update];
}
