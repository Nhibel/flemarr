import { useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys.js';

export type DisplayMode = 'compact' | 'normal';

export const DISPLAY_MODES: DisplayMode[] = ['compact', 'normal'];

const STORAGE_KEY = STORAGE_KEYS.displayMode;

function load(): DisplayMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // A stored 'detailed' from before that mode was retired falls through
    // to the 'normal' default below — no migration needed.
    return raw === 'compact' || raw === 'normal' ? raw : 'normal';
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
