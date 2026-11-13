import { useState } from 'react';

// Must stay equal to panda.config.ts's globalCss html.fontSize fallback —
// two independent constants (Panda config vs TS), not wired together.
export const DEFAULT_FONT_SCALE = 18;
export const MIN_FONT_SCALE = 14;
export const MAX_FONT_SCALE = 24;
export const FONT_SCALE_STEP = 1;

const STORAGE_KEY = 'rom-curator-font-scale';

function clamp(px: number): number {
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, px));
}

function getInitialFontScale(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return DEFAULT_FONT_SCALE;
  const parsed = Number.parseInt(stored, 10);
  return Number.isNaN(parsed) ? DEFAULT_FONT_SCALE : clamp(parsed);
}

// Sets the CSS variable panda.config.ts's root fontSize reads, so the whole
// app's scale (text, padding/gap, maxW widths — all rem-based) updates live
// with no rebuild, exactly like data-theme drives the theme.
function applyFontScale(px: number): void {
  document.documentElement.style.setProperty('--font-scale', `${px}px`);
  localStorage.setItem(STORAGE_KEY, String(px));
}

export function useFontScale() {
  const [fontScale, setFontScaleState] = useState<number>(() => {
    const px = getInitialFontScale();
    applyFontScale(px);
    return px;
  });

  const setFontScale = (next: number) => {
    const clamped = clamp(next);
    applyFontScale(clamped);
    setFontScaleState(clamped);
  };

  return { fontScale, setFontScale };
}
